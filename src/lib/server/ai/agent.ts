import { type Color, type GameState, type PlayerMove } from '$lib/types/game';

import { runMcts, type MctsOptions } from './mcts';

/** Number of MCTS simulations per turn for in-game play. */
const DEFAULT_SIMULATIONS = 150;

export async function chooseAiMove(
	state: GameState,
	color: Color,
	mctsOptions?: MctsOptions
): Promise<PlayerMove | null> {
	const usesModel = mctsOptions?.modelAdapter !== undefined;
	if (usesModel) {
		console.debug(`[AI] Choix du coup avec modèle IA (GPU) pour ${color}`);
	} else {
		console.debug(`[AI] Fallback: choix du coup avec MCTS pur (CPU) pour ${color}`);
	}
	const result = await runMcts(state, color, { simulations: DEFAULT_SIMULATIONS, ...mctsOptions });
	return result.move;
}
