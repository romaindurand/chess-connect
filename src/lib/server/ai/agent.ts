import { type Color, type GameState, type PlayerMove } from '$lib/types/game';

import { runMcts, type MctsOptions } from './mcts';

/** Number of MCTS simulations per turn for in-game play. */
const DEFAULT_SIMULATIONS = 150;

export async function chooseAiMove(
	state: GameState,
	color: Color,
	mctsOptions?: MctsOptions
): Promise<PlayerMove | null> {
	const result = await runMcts(state, color, { simulations: DEFAULT_SIMULATIONS, ...mctsOptions });
	return result.move;
}
