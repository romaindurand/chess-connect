import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
	buildTrainingArtifact,
	runSelfPlayBatch,
	type SelfPlayBatchReport
} from '../../src/lib/server/ai/training';

function readStringArg(name: string, fallback: string): string {
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

const inputFile = resolve(readStringArg('input', 'artifacts/ai/self-play.json'));
const outputFile = resolve(readStringArg('output', 'artifacts/ai/baseline-frequency.json'));

let report: SelfPlayBatchReport;
try {
	report = JSON.parse(readFileSync(inputFile, 'utf8')) as SelfPlayBatchReport;
} catch {
	report = await runSelfPlayBatch({
		games: readNumberArg('games', 32),
		maxPlies: readNumberArg('max-plies', 64)
	});
}

const artifact = buildTrainingArtifact(report.games);
mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, JSON.stringify(artifact, null, 2));

console.table(artifact.openingMoves.slice(0, 10));
console.log(`Artefact écrit dans ${outputFile}`);
