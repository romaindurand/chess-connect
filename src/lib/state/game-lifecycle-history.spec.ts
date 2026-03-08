import { describe, expect, it } from 'vitest';
import { shouldFollowLiveEdge } from '$lib/state/history-live';

describe('history live resume', () => {
	it('returns true only when currently pinned to previous live edge', () => {
		expect(shouldFollowLiveEdge(null, 4)).toBe(false);
		expect(shouldFollowLiveEdge(2, 4)).toBe(false);
		expect(shouldFollowLiveEdge(4, 4)).toBe(true);
		expect(shouldFollowLiveEdge(5, 4)).toBe(false);
	});
});
