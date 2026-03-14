import { type Color, type GameState, type PlayerMove } from '$lib/types/game';

import { runMcts, type MctsOptions } from './mcts';

/** Number of MCTS simulations per turn for in-game play. */
const DEFAULT_SIMULATIONS = 100;

export function chooseAiMove(
	state: GameState,
	color: Color,
	mctsOptions?: MctsOptions
): PlayerMove | null {
	return runMcts(state, color, { simulations: DEFAULT_SIMULATIONS, ...mctsOptions });
}
