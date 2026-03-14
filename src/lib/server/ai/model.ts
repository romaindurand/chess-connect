import * as tf from '@tensorflow/tfjs';

import { BOARD_SIZE } from '$lib/types/game';
import type { Color, GameState, PlayerMove } from '$lib/types/game';

import { ENCODING_SIZE, SPATIAL_SIZE, encodeState } from './encoder';
import { moveToIndex, MOVE_SPACE_SIZE } from './move-index';
import type { ModelAdapter } from './mcts';

const SPATIAL_CHANNELS = 10; // PLANES_PER_CELL
const GLOBAL_SIZE = ENCODING_SIZE - SPATIAL_SIZE; // 10

function residualBlock(x: tf.SymbolicTensor, filters: number): tf.SymbolicTensor {
	const shortcut = x;
	let out = tf.layers
		.conv2d({ filters, kernelSize: 3, padding: 'same', useBias: false })
		.apply(x) as tf.SymbolicTensor;
	out = tf.layers.batchNormalization().apply(out) as tf.SymbolicTensor;
	out = tf.layers.reLU().apply(out) as tf.SymbolicTensor;
	out = tf.layers
		.conv2d({ filters, kernelSize: 3, padding: 'same', useBias: false })
		.apply(out) as tf.SymbolicTensor;
	out = tf.layers.batchNormalization().apply(out) as tf.SymbolicTensor;
	out = tf.layers.add().apply([out, shortcut]) as tf.SymbolicTensor;
	return tf.layers.reLU().apply(out) as tf.SymbolicTensor;
}

export function buildModel(): tf.LayersModel {
	const spatialInput = tf.input({ shape: [BOARD_SIZE, BOARD_SIZE, SPATIAL_CHANNELS] });
	const globalInput = tf.input({ shape: [GLOBAL_SIZE] });

	let x = tf.layers
		.conv2d({ filters: 32, kernelSize: 3, padding: 'same', useBias: false })
		.apply(spatialInput) as tf.SymbolicTensor;
	x = tf.layers.batchNormalization().apply(x) as tf.SymbolicTensor;
	x = tf.layers.reLU().apply(x) as tf.SymbolicTensor;
	x = residualBlock(x, 32);
	x = residualBlock(x, 32);
	const flat = tf.layers.flatten().apply(x) as tf.SymbolicTensor;
	const combined = tf.layers.concatenate().apply([flat, globalInput]) as tf.SymbolicTensor;
	const trunk = tf.layers
		.dense({ units: 64, activation: 'relu' })
		.apply(combined) as tf.SymbolicTensor;

	const policy = tf.layers
		.dense({ units: MOVE_SPACE_SIZE, activation: 'softmax', name: 'policy' })
		.apply(trunk) as tf.SymbolicTensor;
	const value = tf.layers
		.dense({ units: 1, activation: 'tanh', name: 'value' })
		.apply(trunk) as tf.SymbolicTensor;

	return tf.model({ inputs: [spatialInput, globalInput], outputs: [policy, value] });
}

export class TfjsModelAdapter implements ModelAdapter {
	constructor(private readonly model: tf.LayersModel) {}

	async priors(state: GameState, moves: PlayerMove[]): Promise<number[]> {
		const [policyTensor, valueTensor] = this.runInference(state);
		const policyData = (await policyTensor.data()) as Float32Array;
		policyTensor.dispose();
		valueTensor.dispose();
		const indices = moves.map(moveToIndex);
		const raw = indices.map((i) => policyData[i]);
		const sum = raw.reduce((a, b) => a + b, 1e-8);
		return raw.map((v) => v / sum);
	}

	async value(state: GameState, color: Color): Promise<number> {
		const [policyTensor, valueTensor] = this.runInference(state);
		policyTensor.dispose();
		const v = ((await valueTensor.data()) as Float32Array)[0];
		valueTensor.dispose();
		// Value is from the perspective of state.turn; flip if asking for the other side
		return color === state.turn ? v : -v;
	}

	private runInference(state: GameState): [tf.Tensor, tf.Tensor] {
		const encoded = encodeState(state, state.turn);
		const spatial = tf.tensor4d(Array.from(encoded.slice(0, SPATIAL_SIZE)), [
			1,
			BOARD_SIZE,
			BOARD_SIZE,
			SPATIAL_CHANNELS
		]);
		const global = tf.tensor2d(Array.from(encoded.slice(SPATIAL_SIZE)), [1, GLOBAL_SIZE]);
		const [policy, value] = this.model.predict([spatial, global]) as [tf.Tensor, tf.Tensor];
		spatial.dispose();
		global.dispose();
		return [policy, value];
	}
}

class _ModelManager {
	private adapter: TfjsModelAdapter | null = null;
	private _loaded = false;

	async load(checkpointPath: string): Promise<void> {
		const model = await tf.loadLayersModel(`file://${checkpointPath}/model.json`);
		this.adapter = new TfjsModelAdapter(model);
		this._loaded = true;
		console.info(`[AI] Model loaded from ${checkpointPath}`);
	}

	getAdapter(): TfjsModelAdapter | null {
		return this.adapter;
	}

	isLoaded(): boolean {
		return this._loaded;
	}
}

export const ModelManager = new _ModelManager();
