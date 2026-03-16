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
	it('defaults to cpu in production to avoid native runtime crashes', async () => {
		let selectedBackend: 'tensorflow' | 'cpu' | null = null;
		let importedNative = false;

		const result = await initializeBestRuntimeBackend({
			getEnv: (key) => {
				if (key === 'NODE_ENV') return 'production';
				return undefined;
			},
			importTfjsNode: async () => {
				importedNative = true;
			},
			setBackend: async (backend) => {
				selectedBackend = backend;
			},
			ready: async () => undefined,
			validateTensorflowBackend: async () => undefined
		});

		expect(importedNative).toBe(false);
		expect(selectedBackend).toBe('cpu');
		expect(result).toEqual({ backend: 'cpu', fallbackReason: null });
	});

	it('uses tensorflow path in production when explicitly requested', async () => {
		let selectedBackend: 'tensorflow' | 'cpu' | null = null;

		const result = await initializeBestRuntimeBackend({
			getEnv: (key) => {
				if (key === 'NODE_ENV') return 'production';
				if (key === 'AI_RUNTIME_BACKEND') return 'tensorflow';
				return undefined;
			},
			importTfjsNode: async () => undefined,
			setBackend: async (backend) => {
				selectedBackend = backend;
			},
			ready: async () => undefined,
			validateTensorflowBackend: async () => undefined
		});

		expect(selectedBackend).toBe('tensorflow');
		expect(result).toEqual({ backend: 'tensorflow', fallbackReason: null });
	});

	it('selects tensorflow when native backend works', async () => {
		const result = await initializeBestRuntimeBackend({
			getEnv: () => 'development',
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
			getEnv: () => 'development',
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
