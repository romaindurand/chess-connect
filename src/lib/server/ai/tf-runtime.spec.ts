import { describe, expect, it } from 'vitest';

import { chooseTrainingBackend, initializeBestRuntimeBackend } from './tf-runtime';

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

describe('initializeBestRuntimeBackend', () => {
	it('selects tensorflow when native backend works', async () => {
		const result = await initializeBestRuntimeBackend({
			importTfjsNode: async () => undefined,
			setBackend: async () => undefined,
			ready: async () => undefined,
			validateTensorflowBackend: async () => undefined
		});

		expect(result).toEqual({ backend: 'tensorflow', fallbackReason: null });
	});

	it('falls back to cpu when native backend init fails', async () => {
		let selectedBackend: 'tensorflow' | 'cpu' | null = null;
		const result = await initializeBestRuntimeBackend({
			importTfjsNode: async () => {
				throw new Error('native bindings unavailable');
			},
			setBackend: async (backend) => {
				selectedBackend = backend;
			},
			ready: async () => undefined,
			validateTensorflowBackend: async () => undefined
		});

		expect(selectedBackend).toBe('cpu');
		expect(result.backend).toBe('cpu');
		expect(result.fallbackReason).toContain('native bindings unavailable');
	});
});
