#!/usr/bin/env tsx
/**
 * pnpm ai:train-network [-- --dataset=artifacts/ai/self-play.json --output=checkpoints/model --epochs=10 --batch=64]
 *
 * Lit les TrainingSample depuis un rapport self-play JSON et entraîne le réseau
 * TF.js Node (bindings C++ : nettement plus rapide que la version JS pure).
 * Sauvegarde le checkpoint dans <output>/model.json.
 *
 * Note : ce script utilise @tensorflow/tfjs-node (bindings C++) uniquement offline.
 *        Le serveur SvelteKit utilise @tensorflow/tfjs (JS pure) pour la compatibilité Node v24.
 */
import fs from 'node:fs';
import path from 'node:path';

// Importation dynamique de tfjs-node pour cet environnement contrôlé
import * as tf from '@tensorflow/tfjs-node';

const BOARD_SIZE = 4;
const SPATIAL_CHANNELS = 10;
const SPATIAL_SIZE = BOARD_SIZE * BOARD_SIZE * SPATIAL_CHANNELS; // 160
const ENCODING_SIZE = 170;
const GLOBAL_SIZE = ENCODING_SIZE - SPATIAL_SIZE; // 10
const MOVE_SPACE_SIZE = 320;

// ─── CLI args ─────────────────────────────────────────────────────────────────

function readArg(name: string, fallback: string): string {
	const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
	return raw ? raw.slice(name.length + 3) : fallback;
}

function readIntArg(name: string, fallback: number): number {
	const v = Number.parseInt(readArg(name, String(fallback)), 10);
	return Number.isFinite(v) && v > 0 ? v : fallback;
}

const datasetPath = path.resolve(readArg('dataset', 'artifacts/ai/self-play.json'));
const outputPath = path.resolve(readArg('output', 'checkpoints/model'));
const epochs = readIntArg('epochs', 10);
const batchSize = readIntArg('batch', 64);

// ─── Load dataset ─────────────────────────────────────────────────────────────

interface Sample {
	encoded: number[];
	mctsDistribution: number[];
	outcome: number;
}

console.log(`Chargement du dataset depuis ${datasetPath}…`);
const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf8')) as { samples?: Sample[] };
const samples: Sample[] = raw.samples ?? [];

if (samples.length === 0) {
	console.error("Aucun sample trouvé dans le dataset. Lancez d'abord pnpm ai:self-play.");
	process.exit(1);
}
console.log(`${samples.length} samples chargés.`);

// ─── Build tensors ────────────────────────────────────────────────────────────

const n = samples.length;
const spatialBuf = new Float32Array(n * SPATIAL_SIZE);
const globalBuf = new Float32Array(n * GLOBAL_SIZE);
const policyBuf = new Float32Array(n * MOVE_SPACE_SIZE);
const valueBuf = new Float32Array(n);

for (let i = 0; i < n; i++) {
	const s = samples[i];
	spatialBuf.set(s.encoded.slice(0, SPATIAL_SIZE), i * SPATIAL_SIZE);
	globalBuf.set(s.encoded.slice(SPATIAL_SIZE), i * GLOBAL_SIZE);
	policyBuf.set(s.mctsDistribution, i * MOVE_SPACE_SIZE);
	valueBuf[i] = s.outcome;
}

const xSpatial = tf.tensor4d(spatialBuf, [n, BOARD_SIZE, BOARD_SIZE, SPATIAL_CHANNELS]);
const xGlobal = tf.tensor2d(globalBuf, [n, GLOBAL_SIZE]);
const yPolicy = tf.tensor2d(policyBuf, [n, MOVE_SPACE_SIZE]);
const yValue = tf.tensor2d(valueBuf, [n, 1]);

// ─── Build or load model ──────────────────────────────────────────────────────

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

function buildModel(): tf.LayersModel {
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

const modelJsonPath = path.join(outputPath, 'model.json');
let model: tf.LayersModel;
if (fs.existsSync(modelJsonPath)) {
	console.log('Reprise depuis checkpoint existant…');
	model = await tf.loadLayersModel(`file://${modelJsonPath}`);
} else {
	console.log('Nouveau modèle créé.');
	model = buildModel();
}

model.compile({
	optimizer: tf.train.adam(1e-3),
	loss: { policy: 'categoricalCrossentropy', value: 'meanSquaredError' },
	lossWeights: { policy: 1.0, value: 1.0 }
});

// ─── Train ────────────────────────────────────────────────────────────────────

console.log(`Entraînement : ${epochs} époques, batch ${batchSize}…`);
await model.fit([xSpatial, xGlobal], [yPolicy, yValue], {
	epochs,
	batchSize,
	shuffle: true,
	verbose: 1
});

// ─── Save checkpoint ─────────────────────────────────────────────────────────

fs.mkdirSync(outputPath, { recursive: true });
await model.save(`file://${outputPath}`);
console.log(`✓ Checkpoint sauvegardé dans ${outputPath}`);

// Cleanup
xSpatial.dispose();
xGlobal.dispose();
yPolicy.dispose();
yValue.dispose();
