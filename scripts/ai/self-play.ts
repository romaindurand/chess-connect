import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import path from 'node:path';

import { writeSamplesNdjson } from './dataset-io';
import { runSelfPlayBatch } from '../../src/lib/server/ai/training';
import { ModelManager } from '../../src/lib/server/ai/model';
import { initializeBestRuntimeBackend } from '../../src/lib/server/ai/tf-runtime';

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
const outFile = path.resolve('artifacts/ai/self-play.json');

// Initialize TensorFlow runtime and load model
const runtimeBackend = await initializeBestRuntimeBackend();
if (runtimeBackend.fallbackReason) {
	console.warn(
		`[AI] Backend tensorflow indisponible. Fallback automatique sur cpu/js. Détail: ${runtimeBackend.fallbackReason}`
	);
}
console.info(`[AI] Backend TF runtime: ${runtimeBackend.backend}`);

const checkpointPath = process.env.AI_CHECKPOINT_PATH ?? 'checkpoints/model';
const absolutePath = path.resolve(checkpointPath);
try {
	await ModelManager.load(absolutePath);
	console.info(`[AI] Modèle chargé avec succès. Utilisation du GPU pour l'inférence.`);
} catch (error) {
	console.warn(
		`[AI] Impossible de charger le modèle. Fallback sur MCTS pur (sans réseau). Détail: ${error instanceof Error ? error.message : String(error)}`
	);
}

console.log(`Génération de ${games} parties (max ${maxPlies} coups, concurrency=${concurrency})…`);
const startTime = Date.now();

const report = await runSelfPlayBatch({
	games,
	maxPlies,
	concurrency,
	modelAdapter: ModelManager.getAdapter() ?? undefined,
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
