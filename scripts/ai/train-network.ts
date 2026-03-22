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
import { createRequire } from 'node:module';
import path from 'node:path';

import type * as TfjsNode from '@tensorflow/tfjs-node';

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

type BackendMode = 'auto' | 'tensorflow' | 'cpu';

function readBackendMode(): BackendMode {
	const raw = readArg('backend', 'auto');
	if (raw === 'tensorflow' || raw === 'cpu' || raw === 'auto') {
		return raw;
	}
	return 'auto';
}

const datasetPath = path.resolve(readArg('dataset', 'artifacts/ai/self-play.json'));
const outputPath = path.resolve(readArg('output', 'checkpoints/model'));
const epochs = readIntArg('epochs', 10);
const batchSize = readIntArg('batch', 64);
const backendMode = readBackendMode();

const require = createRequire(import.meta.url);
const utilModule = require('node:util') as {
	isNullOrUndefined?: (value: unknown) => boolean;
};
if (typeof utilModule.isNullOrUndefined !== 'function') {
	utilModule.isNullOrUndefined = (value: unknown): boolean => value === null || value === undefined;
}

const tf: typeof TfjsNode = await import('@tensorflow/tfjs-node');

async function validateTensorflowBackend(): Promise<void> {
	const probe = tf.tensor1d([1, 2, 3]);
	const sliced = tf.slice(probe, [0], [1]);
	await sliced.data();
	probe.dispose();
	sliced.dispose();
}

async function initializeBackend(mode: BackendMode): Promise<'tensorflow' | 'cpu'> {
	if (mode === 'cpu') {
		await tf.setBackend('cpu');
		await tf.ready();
		return 'cpu';
	}

	try {
		await tf.setBackend('tensorflow');
		await tf.ready();
		await validateTensorflowBackend();
		return 'tensorflow';
	} catch (error) {
		if (mode === 'tensorflow') {
			throw new Error(
				`Impossible d'initialiser le backend tensorflow natif. Détail: ${error instanceof Error ? error.message : String(error)}`
			);
		}
		console.warn(
			'[AI] Backend tensorflow indisponible sur cet environnement. Bascule automatique en backend cpu (plus lent).'
		);
		await tf.setBackend('cpu');
		await tf.ready();
		return 'cpu';
	}
}

const selectedBackend = await initializeBackend(backendMode);

if (selectedBackend === 'cpu') {
	console.warn(
		'[AI] Entraînement en backend CPU (plus lent). Utilisez --backend=tensorflow pour forcer un test du backend natif.'
	);
}
console.log(`[AI] Backend actif: ${tf.getBackend()}`);

// ─── Load dataset ─────────────────────────────────────────────────────────────

interface Sample {
	encoded: number[];
	mctsDistribution: number[];
	outcome: number;
}

interface BatchLossPoint {
	globalBatch: number;
	epoch: number;
	batchInEpoch: number;
	loss: number;
	elapsedMs: number;
}

interface EpochLossPoint {
	epoch: number;
	loss: number;
	elapsedMs: number;
}

interface LossMetricsReport {
	status: 'running' | 'completed' | 'failed';
	startedAt: string;
	updatedAt: string;
	datasetPath: string;
	outputPath: string;
	backend: string;
	epochs: number;
	batchSize: number;
	totalSamples: number;
	batchesPerEpoch: number;
	currentEpoch: number;
	batchLossSamples: BatchLossPoint[];
	epochLosses: EpochLossPoint[];
	errorMessage?: string;
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
	if ((i + 1) % Math.max(1, Math.floor(n / 20)) === 0 || i + 1 === n) {
		const pct = Math.round(((i + 1) / n) * 100);
		process.stdout.write(`\rPréparation des tenseurs: ${i + 1}/${n} (${pct}%)   `);
	}
}
process.stdout.write('\n');

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

function formatEta(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return '…';
	if (seconds < 60) return `${seconds}s`;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
	return `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, '0')}m`;
}

console.log(`Entraînement : ${epochs} époques, batch ${batchSize}…`);
fs.mkdirSync(outputPath, { recursive: true });

const trainStart = Date.now();
const batchesPerEpoch = Math.ceil(n / batchSize);
const totalBatches = Math.max(1, batchesPerEpoch * epochs);
const metricsPath = path.join(outputPath, 'training-loss.json');
const batchLossSamples: BatchLossPoint[] = [];
const epochLosses: EpochLossPoint[] = [];
const sampledBatchInterval = Math.max(1, Math.floor(batchesPerEpoch / 50));
const maxBatchSamples = 10_000;

let currentEpoch = 1;
let lastMetricsWrite = 0;
let currentStatus: LossMetricsReport['status'] = 'running';

function writeMetrics(force = false, errorMessage?: string): void {
	const now = Date.now();
	if (!force && now - lastMetricsWrite < 1_000) {
		return;
	}
	lastMetricsWrite = now;

	const report: LossMetricsReport = {
		status: currentStatus,
		startedAt: new Date(trainStart).toISOString(),
		updatedAt: new Date(now).toISOString(),
		datasetPath,
		outputPath,
		backend: tf.getBackend(),
		epochs,
		batchSize,
		totalSamples: n,
		batchesPerEpoch,
		currentEpoch,
		batchLossSamples,
		epochLosses,
		errorMessage
	};

	fs.writeFileSync(metricsPath, JSON.stringify(report, null, 2));
}

writeMetrics(true);

let lastPrint = 0;
try {
	await model.fit([xSpatial, xGlobal], [yPolicy, yValue], {
		epochs,
		batchSize,
		shuffle: true,
		verbose: 0,
		callbacks: {
			onEpochBegin: (epoch: number) => {
				currentEpoch = epoch + 1;
			},
			onBatchEnd: (batch: number, logs?) => {
				const now = Date.now();
				const doneBatches = (currentEpoch - 1) * batchesPerEpoch + (batch + 1);
				const clampedDone = Math.min(totalBatches, Math.max(1, doneBatches));
				const elapsed = now - trainStart;
				const etaSec = Math.round(((elapsed / clampedDone) * (totalBatches - clampedDone)) / 1000);
				const pct = Math.round((clampedDone / totalBatches) * 100);
				const lossRaw = logs?.loss;
				const lossValue = typeof lossRaw === 'number' ? lossRaw : 0;
				const loss = lossValue.toFixed(4);

				const batchInEpoch = batch + 1;
				if (batchInEpoch % sampledBatchInterval === 0 || batchInEpoch === batchesPerEpoch) {
					batchLossSamples.push({
						globalBatch: clampedDone,
						epoch: currentEpoch,
						batchInEpoch,
						loss: lossValue,
						elapsedMs: elapsed
					});
					if (batchLossSamples.length > maxBatchSamples) {
						batchLossSamples.splice(0, batchLossSamples.length - maxBatchSamples);
					}
				}

				if (now - lastPrint >= 250) {
					lastPrint = now;
					process.stdout.write(
						`\r  Entraînement ${pct}% — époque ${currentEpoch}/${epochs}, batch ${batchInEpoch}/${batchesPerEpoch} — loss: ${loss} — ETA : ${formatEta(etaSec)}   `
					);
				}

				writeMetrics(false);
			},
			onEpochEnd: (epoch: number, logs?) => {
				const done = epoch + 1;
				const elapsed = Date.now() - trainStart;
				const etaSec = Math.round(((elapsed / done) * (epochs - done)) / 1000);
				const lossRaw = logs?.loss;
				const lossValue = typeof lossRaw === 'number' ? lossRaw : 0;
				epochLosses.push({
					epoch: done,
					loss: lossValue,
					elapsedMs: elapsed
				});
				const loss = lossValue.toFixed(4);
				process.stdout.write(
					`\r  Époque ${done}/${epochs} terminée — loss: ${loss} — ETA global : ${formatEta(etaSec)}   `
				);
				writeMetrics(true);
			}
		}
	});
	currentStatus = 'completed';
	writeMetrics(true);
} catch (error) {
	currentStatus = 'failed';
	writeMetrics(true, error instanceof Error ? error.message : String(error));
	throw error;
}
process.stdout.write('\n');

// ─── Save checkpoint ─────────────────────────────────────────────────────────

await model.save(`file://${outputPath}`);
console.log(`✓ Checkpoint sauvegardé dans ${outputPath}`);
console.log(`✓ Courbe de loss exportée dans ${metricsPath}`);
console.log(`ℹ Lancez le dashboard avec: pnpm ai:loss-dashboard -- --metrics=${metricsPath}`);

// Cleanup
xSpatial.dispose();
xGlobal.dispose();
yPolicy.dispose();
yValue.dispose();
