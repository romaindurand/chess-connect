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

function formatEta(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return '…';
	if (seconds < 60) return `${seconds}s`;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
	return `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, '0')}m`;
}

const inputFile = resolve(readStringArg('input', 'artifacts/ai/self-play.json'));
const outputFile = resolve(readStringArg('output', 'artifacts/ai/baseline-frequency.json'));

let report: SelfPlayBatchReport;
try {
	report = JSON.parse(readFileSync(inputFile, 'utf8')) as SelfPlayBatchReport;
} catch {
	const games = readNumberArg('games', 32);
	const maxPlies = readNumberArg('max-plies', 64);
	console.log(`Dataset introuvable. Génération de ${games} parties…`);
	const startTime = Date.now();
	report = await runSelfPlayBatch({
		games,
		maxPlies,
		onGameComplete: (done, total) => {
			const elapsed = Date.now() - startTime;
			const etaSec = Math.round(((elapsed / done) * (total - done)) / 1000);
			process.stdout.write(`\r  Partie ${done}/${total} — ETA : ${formatEta(etaSec)}   `);
		}
	});
	process.stdout.write('\n');
}

const artifact = buildTrainingArtifact(report.games);
mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, JSON.stringify(artifact, null, 2));

console.table(artifact.openingMoves.slice(0, 10));
console.log(`Artefact écrit dans ${outputFile}`);
