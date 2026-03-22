import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

import type { RecordedGame } from '../../src/lib/server/ai/game-recorder';
import { replayGameWithMctsTargets } from '../../src/lib/server/ai/reanalysis';
import type { TrainingSample } from '../../src/lib/server/ai/training';
import { readSamplesNdjson, writeSamplesNdjson } from './dataset-io';

function readArg(name: string, fallback: string): string {
	const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
	return raw ? raw.slice(name.length + 3) : fallback;
}

function readNumberArg(name: string, fallback: number): number {
	const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
	if (!raw) {
		return fallback;
	}
	const value = Number.parseInt(raw.slice(name.length + 3), 10);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readMultiArg(name: string): string[] {
	const prefix = `--${name}=`;
	return process.argv
		.filter((arg) => arg.startsWith(prefix))
		.map((arg) => arg.slice(prefix.length));
}

function formatEta(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return '...';
	if (seconds < 60) return `${seconds}s`;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
	return `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, '0')}m`;
}

async function readJsonlGames(filePath: string): Promise<RecordedGame[]> {
	const abs = resolve(filePath);
	if (!existsSync(abs)) {
		return [];
	}
	const out: RecordedGame[] = [];
	const rl = createInterface({
		input: createReadStream(abs),
		crlfDelay: Infinity
	});

	for await (const line of rl) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			out.push(JSON.parse(trimmed) as RecordedGame);
		} catch {
			// Ignore malformed lines.
		}
	}

	return out;
}

const gamesFiles = readMultiArg('games');
const defaultRecorded = 'artifacts/ai/recorded-games.jsonl';
const inputFiles = gamesFiles.length > 0 ? gamesFiles : [defaultRecorded];
const baseDataset = resolve(readArg('base', 'artifacts/ai/self-play.json'));
const outputFile = resolve(readArg('output', 'artifacts/ai/training-data.json'));
const simulations = readNumberArg('simulations', 32);
const maxGames = readNumberArg('max-games', Number.MAX_SAFE_INTEGER);
const maxSamplesPerGame = readNumberArg('max-samples-per-game', Number.MAX_SAFE_INTEGER);

console.log(`Lecture des parties depuis ${inputFiles.length} source(s)...`);

const dedup = new Map<string, RecordedGame>();
for (const file of inputFiles) {
	const games = await readJsonlGames(file);
	for (const game of games) {
		dedup.set(game.id, game);
	}
	console.log(`  ${file}: ${games.length} partie(s) lues`);
}

const recordedGames = [...dedup.values()].slice(0, maxGames);

let baseSamples: TrainingSample[] = [];
try {
	const { samples } = await readSamplesNdjson(baseDataset);
	baseSamples = samples;
} catch {
	baseSamples = [];
}

console.log(
	`Reanalyse MCTS de ${recordedGames.length} partie(s) (simulations=${simulations}, maxSamplesPerGame=${maxSamplesPerGame})...`
);

const start = Date.now();
const reanalyzedSamples: TrainingSample[] = [];
for (let i = 0; i < recordedGames.length; i++) {
	const samples = await replayGameWithMctsTargets(recordedGames[i], {
		simulations,
		maxSamplesPerGame
	});
	reanalyzedSamples.push(...samples);

	const done = i + 1;
	const elapsed = Date.now() - start;
	const etaSec = Math.round(((elapsed / done) * (recordedGames.length - done)) / 1000);
	process.stdout.write(
		`\r  Partie ${done}/${recordedGames.length} -> ${reanalyzedSamples.length} samples — ETA : ${formatEta(etaSec)}   `
	);
}
process.stdout.write('\n');

const allSamples = [...baseSamples, ...reanalyzedSamples];
const summary = {
	baseSamples: baseSamples.length,
	reanalyzedSamples: reanalyzedSamples.length,
	totalSamples: allSamples.length,
	recordedGames: recordedGames.length,
	simulations,
	maxSamplesPerGame
};

await writeSamplesNdjson(outputFile, { summary }, allSamples);

console.table(summary);
console.log(`Dataset écrit dans ${outputFile} (${allSamples.length} samples, format NDJSON)`);
