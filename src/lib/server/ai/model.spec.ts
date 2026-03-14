import { describe, expect, it } from 'vitest';

import { buildModel, ModelManager, TfjsModelAdapter } from './model';
import { makeActiveState } from './test-helpers';

describe('model', () => {
	it('buildModel returns a LayersModel with two outputs', () => {
		const model = buildModel();
		expect(model.outputs).toHaveLength(2);
	});

	it('TfjsModelAdapter.priors returns array of correct length', async () => {
		const model = buildModel();
		const adapter = new TfjsModelAdapter(model);
		const state = makeActiveState();
		const moves = [{ kind: 'place' as const, piece: 'pawn' as const, to: { x: 0, y: 0 } }];
		const priors = await adapter.priors(state, moves);
		expect(priors).toHaveLength(1);
		expect(priors[0]).toBeGreaterThan(0);
	});

	it('TfjsModelAdapter.value returns number in [-1, 1]', async () => {
		const model = buildModel();
		const adapter = new TfjsModelAdapter(model);
		const state = makeActiveState();
		const v = await adapter.value(state, 'white');
		expect(v).toBeGreaterThanOrEqual(-1);
		expect(v).toBeLessThanOrEqual(1);
	});

	it('ModelManager.getAdapter returns null before load', () => {
		expect(ModelManager.getAdapter()).toBeNull();
	});
});
