import * as tf from '@tensorflow/tfjs';

export type TrainingBackend = 'tensorflow' | 'cpu';

export type RuntimeBackend = 'tensorflow' | 'cpu';

interface RuntimeBackendDeps {
	importTfjsNode: () => Promise<unknown>;
	setBackend: (backend: RuntimeBackend) => Promise<unknown>;
	ready: () => Promise<void>;
	validateTensorflowBackend: () => Promise<void>;
}

export interface RuntimeBackendResult {
	backend: RuntimeBackend;
	fallbackReason: string | null;
}

function defaultDeps(): RuntimeBackendDeps {
	return {
		importTfjsNode: () => import('@tensorflow/tfjs-node'),
		setBackend: (backend) => tf.setBackend(backend),
		ready: () => tf.ready(),
		validateTensorflowBackend: async () => {
			const probe = tf.tensor1d([1, 2, 3]);
			const sliced = tf.slice(probe, [0], [1]);
			await sliced.data();
			probe.dispose();
			sliced.dispose();
		}
	};
}

export async function initializeBestRuntimeBackend(
	overrides: Partial<RuntimeBackendDeps> = {}
): Promise<RuntimeBackendResult> {
	const deps = { ...defaultDeps(), ...overrides };

	try {
		await deps.importTfjsNode();
		await deps.setBackend('tensorflow');
		await deps.ready();
		await deps.validateTensorflowBackend();
		return { backend: 'tensorflow', fallbackReason: null };
	} catch (error) {
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
