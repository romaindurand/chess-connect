import type { HistorySnapshot, MoveHistoryEntry } from '$lib/types/game';

interface DrawResetStateLike {
	status: string;
	winner: string | null;
	moveHistory: MoveHistoryEntry[];
	gameNumber: number;
}

export function shouldFollowLiveEdge(
	historyStep: number | null,
	previousMoveHistoryLength: number
): boolean {
	return historyStep !== null && historyStep === previousMoveHistoryLength;
}

export function getSnapshotForHistoryStep(
	entries: MoveHistoryEntry[],
	step: number
): HistorySnapshot | null {
	if (entries.length === 0) {
		return null;
	}
	if (step === 0) {
		return entries[0].before;
	}
	if (step > 0 && step < entries.length) {
		return entries[step - 1].after;
	}
	if (step === entries.length) {
		return null;
	}
	return null;
}

export function isAutomaticDrawRoundReset(
	previousState: DrawResetStateLike | null,
	nextState: DrawResetStateLike
): boolean {
	if (!previousState) {
		return false;
	}

	return (
		previousState.status === 'active' &&
		!previousState.winner &&
		previousState.moveHistory.length > 0 &&
		nextState.status === 'active' &&
		nextState.gameNumber === previousState.gameNumber + 1 &&
		nextState.moveHistory.length === 0
	);
}
