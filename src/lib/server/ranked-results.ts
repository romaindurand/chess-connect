import type { Color } from '$lib/types/game';

import { getGameOrThrow } from './game-store';
import { applyRankedResultByUsernames } from './ranking-store';

export async function maybeApplyRankedResultForGame(gameId: string): Promise<void> {
	const record = getGameOrThrow(gameId);
	const state = record.state;
	if (state.status !== 'finished' || !state.winner) {
		return;
	}
	if (state.options.isRanked !== true) {
		return;
	}

	const roundKey = `${state.id}#${state.gameNumber}`;
	if (state.options.rankedRoundKeyApplied === roundKey) {
		return;
	}

	const winnerColor = state.winner as Color;
	const loserColor = winnerColor === 'white' ? 'black' : 'white';
	const winnerName = state.players[winnerColor]?.name;
	const loserName = state.players[loserColor]?.name;
	if (!winnerName || !loserName) {
		return;
	}

	const result = await applyRankedResultByUsernames({
		gameRoundKey: roundKey,
		winnerUsername: winnerName,
		loserUsername: loserName
	});
	if (!result) {
		return;
	}

	state.options.rankedRoundKeyApplied = roundKey;
	state.options.rankedWhiteDelta = winnerColor === 'white' ? result.winnerDelta : result.loserDelta;
	state.options.rankedBlackDelta = winnerColor === 'black' ? result.winnerDelta : result.loserDelta;
}
