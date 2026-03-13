import { describe, expect, it } from 'vitest';

import { buildTrainingArtifact, runSelfPlayBatch } from './training';

describe('ai training scaffold', () => {
	it('plays a deterministic self-play batch and aggregates outcomes', () => {
		const report = runSelfPlayBatch({ games: 4, maxPlies: 12 });

		expect(report.games).toHaveLength(4);
		expect(report.summary.totalGames).toBe(4);
		expect(report.summary.whiteWins + report.summary.blackWins + report.summary.draws).toBe(4);
		expect(report.summary.averagePlies).toBeGreaterThan(0);
		expect(report.summary.averagePlies).toBeLessThanOrEqual(12);
	});

	it('builds a baseline artifact from self-play openings', () => {
		const report = runSelfPlayBatch({ games: 3, maxPlies: 8 });
		const artifact = buildTrainingArtifact(report.games);

		expect(artifact.model).toBe('baseline-frequency');
		expect(artifact.generatedFromGames).toBe(3);
		expect(artifact.openingMoves.length).toBeGreaterThan(0);
		expect(artifact.openingMoves[0]?.move).toMatch(/^(place|move):/);
	});
});
