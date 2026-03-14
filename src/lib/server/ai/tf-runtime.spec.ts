import { describe, expect, it } from 'vitest';

import { chooseTrainingBackend } from './tf-runtime';

describe('chooseTrainingBackend', () => {
	it('uses tensorflow backend before Node 24', () => {
		expect(chooseTrainingBackend('22.18.0')).toBe('tensorflow');
		expect(chooseTrainingBackend('23.9.1')).toBe('tensorflow');
	});

	it('falls back to cpu backend on Node 24+', () => {
		expect(chooseTrainingBackend('24.0.0')).toBe('cpu');
		expect(chooseTrainingBackend('25.1.0')).toBe('cpu');
	});

	it('falls back to cpu when version is malformed', () => {
		expect(chooseTrainingBackend('x.y.z')).toBe('cpu');
	});
});
