import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { buildTrainingArtifact, runSelfPlayBatch } from '../../src/lib/server/ai/training';

function readNumberArg(name: string, fallback: number): number {
	const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
	if (!raw) {
		return fallback;
	}
	const value = Number.parseInt(raw.slice(name.length + 3), 10);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

const games = readNumberArg('games', 64);
const maxPlies = readNumberArg('max-plies', 64);
const datasetFile = resolve('artifacts/ai/self-play.json');
const modelFile = resolve('artifacts/ai/baseline-frequency.json');

const report = runSelfPlayBatch({ games, maxPlies });
const artifact = buildTrainingArtifact(report.games);

mkdirSync(dirname(datasetFile), { recursive: true });
writeFileSync(datasetFile, JSON.stringify(report, null, 2));
writeFileSync(modelFile, JSON.stringify(artifact, null, 2));

console.table(report.summary);
console.table(artifact.openingMoves.slice(0, 10));
console.log(`Auto-train terminé. Dataset: ${datasetFile}`);
console.log(`Auto-train terminé. Artefact: ${modelFile}`);
