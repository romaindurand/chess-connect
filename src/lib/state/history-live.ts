import type { HistorySnapshot, MoveHistoryEntry } from '$lib/types/game';

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
