import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { runSelfPlayBatch } from '../../src/lib/server/ai/training';

function readNumberArg(name: string, fallback: number): number {
	const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
	if (!raw) {
		return fallback;
	}
	const value = Number.parseInt(raw.slice(name.length + 3), 10);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

const games = readNumberArg('games', 32);
const maxPlies = readNumberArg('max-plies', 64);
const outFile = resolve('artifacts/ai/self-play.json');
const report = await runSelfPlayBatch({ games, maxPlies });

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(report, null, 2));

console.table(report.summary);
console.log(`Dataset écrit dans ${outFile}`);
