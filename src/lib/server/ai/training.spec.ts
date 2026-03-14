import { describe, expect, it } from 'vitest';

import { buildTrainingArtifact, runSelfPlayBatch } from './training';
import { ENCODING_SIZE } from './encoder';
import { MOVE_SPACE_SIZE } from './move-index';

describe('ai training scaffold', () => {
	it(
		'plays a deterministic self-play batch and aggregates outcomes',
		{ timeout: 30_000 },
		async () => {
			const report = await runSelfPlayBatch({ games: 4, maxPlies: 12 });

			expect(report.games).toHaveLength(4);
			expect(report.summary.totalGames).toBe(4);
			expect(report.summary.whiteWins + report.summary.blackWins + report.summary.draws).toBe(4);
			expect(report.summary.averagePlies).toBeGreaterThan(0);
			expect(report.summary.averagePlies).toBeLessThanOrEqual(12);
		}
	);

	it('builds a baseline artifact from self-play openings', { timeout: 30_000 }, async () => {
		const report = await runSelfPlayBatch({ games: 3, maxPlies: 8 });
		const artifact = buildTrainingArtifact(report.games);

		expect(artifact.model).toBe('baseline-frequency');
		expect(artifact.generatedFromGames).toBe(3);
		expect(artifact.openingMoves.length).toBeGreaterThan(0);
		expect(artifact.openingMoves[0]?.move).toMatch(/^(place|move):/);
	});

	it('collects training samples with correct shape', { timeout: 60_000 }, async () => {
		const report = await runSelfPlayBatch({ games: 1, maxPlies: 30 });
		expect(report.samples.length).toBeGreaterThan(0);
		expect(report.samples[0].encoded).toHaveLength(ENCODING_SIZE);
		expect(report.samples[0].mctsDistribution).toHaveLength(MOVE_SPACE_SIZE);
		expect([-1, 0, 1]).toContain(report.samples[0].outcome);
	});
});
