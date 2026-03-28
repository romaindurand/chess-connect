import type { Color } from '$lib/types/game';

import { getGameOrThrow } from './game-store';
import { applyRapidResultByUsernames } from './rapid-ranking-store';

export async function maybeApplyRapidResultForGame(gameId: string): Promise<void> {
	const record = getGameOrThrow(gameId);
	const state = record.state;
	if (state.status !== 'finished' || !state.winner) {
		return;
	}
	if (state.options.isRapid !== true) {
		return;
	}

	const roundKey = `${state.id}#${state.gameNumber}`;
	if (state.options.rapidRoundKeyApplied === roundKey) {
		return;
	}

	const winnerColor = state.winner as Color;
	const loserColor = winnerColor === 'white' ? 'black' : 'white';
	const winnerName = state.players[winnerColor]?.name;
	const loserName = state.players[loserColor]?.name;
	if (!winnerName || !loserName) {
		return;
	}

	const result = await applyRapidResultByUsernames({
		gameRoundKey: roundKey,
		winnerUsername: winnerName,
		loserUsername: loserName
	});
	if (!result) {
		return;
	}

	state.options.rapidRoundKeyApplied = roundKey;
}
