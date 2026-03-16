import * as tf from '@tensorflow/tfjs';
import { createRequire } from 'node:module';

export type TrainingBackend = 'tensorflow' | 'cpu';

export type RuntimeBackend = 'tensorflow' | 'cpu';
export type RuntimeBackendMode = 'auto' | 'cpu' | 'tensorflow';

interface RuntimeBackendDeps {
	importTfjsNode: () => Promise<unknown>;
	setBackend: (backend: RuntimeBackend) => Promise<unknown>;
	ready: () => Promise<void>;
	validateTensorflowBackend: () => Promise<void>;
	getEnv: (key: string) => string | undefined;
}

export interface RuntimeBackendResult {
	backend: RuntimeBackend;
	fallbackReason: string | null;
}

function defaultDeps(): RuntimeBackendDeps {
	const require = createRequire(import.meta.url);
	return {
		importTfjsNode: async () => {
			const utilModule = require('node:util') as {
				isNullOrUndefined?: (value: unknown) => boolean;
			};
			if (typeof utilModule.isNullOrUndefined !== 'function') {
				utilModule.isNullOrUndefined = (value: unknown): boolean =>
					value === null || value === undefined;
			}
			// Load tfjs-node at runtime to avoid SSR bundling issues in the server build.
			require('@tensorflow/tfjs-node');
		},
		setBackend: (backend) => tf.setBackend(backend),
		ready: () => tf.ready(),
		getEnv: (key) => process.env[key],
		validateTensorflowBackend: async () => {
			const probe = tf.tensor1d([1, 2, 3]);
			const sliced = tf.slice(probe, [0], [1]);
			await sliced.data();
			probe.dispose();
			sliced.dispose();
		}
	};
}

function resolveRuntimeBackendMode(getEnv: RuntimeBackendDeps['getEnv']): RuntimeBackendMode {
	const rawMode = getEnv('AI_RUNTIME_BACKEND')?.trim().toLowerCase();
	if (rawMode === 'cpu' || rawMode === 'tensorflow' || rawMode === 'auto') {
		return rawMode;
	}

	const nodeEnv = getEnv('NODE_ENV')?.trim().toLowerCase();
	return nodeEnv === 'production' ? 'cpu' : 'auto';
}

export async function initializeBestRuntimeBackend(
	overrides: Partial<RuntimeBackendDeps> = {}
): Promise<RuntimeBackendResult> {
	const deps = { ...defaultDeps(), ...overrides };
	const mode = resolveRuntimeBackendMode(deps.getEnv);

	if (mode === 'cpu') {
		await deps.setBackend('cpu');
		await deps.ready();
		return { backend: 'cpu', fallbackReason: null };
	}

	try {
		await deps.importTfjsNode();
		await deps.setBackend('tensorflow');
		await deps.ready();
		await deps.validateTensorflowBackend();
		return { backend: 'tensorflow', fallbackReason: null };
	} catch (error) {
		if (mode === 'tensorflow') {
			throw error;
		}
		const reason = error instanceof Error ? error.message : String(error);
		await deps.setBackend('cpu');
		await deps.ready();
		return { backend: 'cpu', fallbackReason: reason };
	}
}

export function chooseTrainingBackend(nodeVersion = process.versions.node): TrainingBackend {
	const majorRaw = nodeVersion.split('.')[0] ?? '';
	const major = Number.parseInt(majorRaw, 10);
	if (!Number.isFinite(major)) {
		return 'cpu';
	}
	return major >= 24 ? 'cpu' : 'tensorflow';
}
