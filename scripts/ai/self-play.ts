import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { writeSamplesNdjson } from './dataset-io';
import { runSelfPlayBatch } from '../../src/lib/server/ai/training';

function readNumberArg(name: string, fallback: number): number {
	const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
	if (!raw) {
		return fallback;
	}
	const value = Number.parseInt(raw.slice(name.length + 3), 10);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatEta(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return '…';
	if (seconds < 60) return `${seconds}s`;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
	return `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, '0')}m`;
}

const games = readNumberArg('games', 32);
const maxPlies = readNumberArg('max-plies', 64);
const concurrency = readNumberArg('concurrency', 5);
const outFile = resolve('artifacts/ai/self-play.json');

console.log(`Génération de ${games} parties (max ${maxPlies} coups, concurrency=${concurrency})…`);
const startTime = Date.now();

const report = await runSelfPlayBatch({
	games,
	maxPlies,
	concurrency,
	onGameComplete: (done, total) => {
		const elapsed = Date.now() - startTime;
		const etaSec = Math.round(((elapsed / done) * (total - done)) / 1000);
		process.stdout.write(`\r  Partie ${done}/${total} — ETA : ${formatEta(etaSec)}   `);
	}
});
process.stdout.write('\n');

mkdirSync(dirname(outFile), { recursive: true });
await writeSamplesNdjson(outFile, { summary: report.summary, games: report.games }, report.samples);

console.table(report.summary);
console.log(`Dataset écrit dans ${outFile} (${report.samples.length} samples, format NDJSON)`);
