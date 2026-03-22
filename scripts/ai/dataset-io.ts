/**
 * Streaming NDJSON I/O for large training datasets.
 *
 * Format:
 *   Line 1  : JSON header { version: 1, totalSamples: N, ...metadata }
 *   Line 2+ : one compact JSON sample per line
 *
 * Falls back to legacy whole-file JSON for files written before this format.
 */
import { createReadStream, createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';

import type { TrainingSample } from '../../src/lib/server/ai/training';

export type DatasetHeader = Record<string, unknown>;

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Write samples as NDJSON: one header line then one compact JSON line per sample.
 * Never builds the full dataset as a single string → supports any dataset size.
 */
export async function writeSamplesNdjson(
	path: string,
	header: DatasetHeader,
	samples: TrainingSample[]
): Promise<void> {
	mkdirSync(dirname(path), { recursive: true });
	const stream = createWriteStream(path);

	stream.write(JSON.stringify({ version: 1, totalSamples: samples.length, ...header }) + '\n');

	for (const sample of samples) {
		const flushed = stream.write(JSON.stringify(sample) + '\n');
		if (!flushed) {
			await new Promise<void>((res) => stream.once('drain', res));
		}
	}

	return new Promise<void>((resolve, reject) => {
		stream.end();
		stream.on('finish', resolve);
		stream.on('error', reject);
	});
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function* readLines(path: string): AsyncGenerator<string> {
	const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
	try {
		for await (const line of rl) {
			const trimmed = line.trim();
			if (trimmed) yield trimmed;
		}
	} finally {
		rl.close();
	}
}

type WithSamples = DatasetHeader & { samples?: TrainingSample[] };

function parseLegacyFile(path: string): { header: DatasetHeader; samples: TrainingSample[] } {
	const raw = JSON.parse(readFileSync(path, 'utf8')) as WithSamples;
	const { samples, ...rest } = raw;
	return { header: rest, samples: samples ?? [] };
}

// ─── Read: header only ────────────────────────────────────────────────────────

/**
 * Read only the header line without loading samples.
 * Useful when only metadata is needed (e.g. train.ts reading self-play metadata).
 */
export async function readDatasetHeader(path: string): Promise<DatasetHeader> {
	for await (const line of readLines(path)) {
		let parsed: DatasetHeader;
		try {
			parsed = JSON.parse(line) as DatasetHeader;
		} catch {
			// Multi-line pretty-printed legacy JSON
			return parseLegacyFile(path).header;
		}
		// NDJSON header or legacy compact JSON — strip the samples array if present
		const { samples: _s, ...rest } = parsed as WithSamples;
		void _s;
		return rest;
	}
	return {};
}

// ─── Read: stream samples ─────────────────────────────────────────────────────

/**
 * Stream samples one at a time without loading them all into memory.
 * Skips the NDJSON header line automatically.
 * Falls back to iterating the legacy samples array for old-format files.
 * Returns the actual number of samples streamed.
 */
export async function streamSampleLines(
	path: string,
	onSample: (sample: TrainingSample, index: number) => void
): Promise<number> {
	let isFirstLine = true;
	let isNdjson = false;
	let index = 0;

	for await (const line of readLines(path)) {
		if (isFirstLine) {
			isFirstLine = false;
			let parsed: DatasetHeader;
			try {
				parsed = JSON.parse(line) as DatasetHeader;
			} catch {
				// Multi-line legacy JSON
				const { samples } = parseLegacyFile(path);
				for (let i = 0; i < samples.length; i++) onSample(samples[i], i);
				return samples.length;
			}

			if (typeof parsed.version === 'number') {
				isNdjson = true;
				continue; // header line consumed, samples follow
			}

			// Compact legacy JSON (full file on one line)
			const samples = (parsed as WithSamples).samples ?? [];
			for (let i = 0; i < samples.length; i++) onSample(samples[i], i);
			return samples.length;
		}

		if (!isNdjson) break;

		try {
			onSample(JSON.parse(line) as TrainingSample, index++);
		} catch {
			// Skip malformed lines
		}
	}

	return index;
}

// ─── Read: all samples into memory ───────────────────────────────────────────

/**
 * Read all samples and header into memory (single pass).
 * For backward compat, handles both NDJSON and legacy whole-file JSON.
 * Avoid this for very large (> few hundred MB) files; prefer streamSampleLines.
 */
export async function readSamplesNdjson(
	path: string
): Promise<{ header: DatasetHeader; samples: TrainingSample[] }> {
	let header: DatasetHeader = {};
	let isFirstLine = true;
	let isNdjson = false;
	const samples: TrainingSample[] = [];

	for await (const line of readLines(path)) {
		if (isFirstLine) {
			isFirstLine = false;
			let parsed: DatasetHeader;
			try {
				parsed = JSON.parse(line) as DatasetHeader;
			} catch {
				return parseLegacyFile(path);
			}

			if (typeof parsed.version === 'number') {
				isNdjson = true;
				const { samples: _s, ...rest } = parsed as WithSamples;
				void _s;
				header = rest;
				continue;
			}

			// Compact legacy JSON
			const { samples: s, ...rest } = parsed as WithSamples;
			return { header: rest, samples: s ?? [] };
		}

		if (!isNdjson) break;

		try {
			samples.push(JSON.parse(line) as TrainingSample);
		} catch {
			// Skip malformed lines
		}
	}

	return { header, samples };
}
