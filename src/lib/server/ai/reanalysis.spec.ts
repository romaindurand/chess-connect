import { describe, expect, it } from 'vitest';

import { ENCODING_SIZE } from './encoder';
import type { RecordedGame } from './game-recorder';
import { MOVE_SPACE_SIZE } from './move-index';
import { replayGameWithMctsTargets } from './reanalysis';

describe('reanalysis', () => {
	it('replays a recorded game and emits MCTS policy distributions', async () => {
		const game: RecordedGame = {
			id: 'g1',
			playedAt: Date.now(),
			winner: 'white',
			source: 'human-vs-human',
			moves: [
				{ color: 'white', move: { kind: 'place', piece: 'rook', to: { x: 0, y: 0 } } },
				{ color: 'black', move: { kind: 'place', piece: 'rook', to: { x: 0, y: 3 } } },
				{ color: 'white', move: { kind: 'place', piece: 'pawn', to: { x: 1, y: 0 } } },
				{ color: 'black', move: { kind: 'place', piece: 'pawn', to: { x: 1, y: 3 } } }
			]
		};

		const samples = await replayGameWithMctsTargets(game, {
			simulations: 4
		});

		expect(samples.length).toBe(4);
		expect(samples[0].encoded).toHaveLength(ENCODING_SIZE);
		expect(samples[0].mctsDistribution).toHaveLength(MOVE_SPACE_SIZE);
		expect(samples[0].mctsDistribution.some((x) => x > 0)).toBe(true);
		expect([-1, 0, 1]).toContain(samples[0].outcome);
	});
});
