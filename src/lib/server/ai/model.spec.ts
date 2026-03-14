import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	buildModel,
	ModelManager,
	readModelArtifactsFromCheckpoint,
	TfjsModelAdapter
} from './model';
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

	it('readModelArtifactsFromCheckpoint reads manifest shards from disk', () => {
		const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-model-'));
		const checkpointDir = path.join(tempDir, 'checkpoint');
		mkdirSync(checkpointDir, { recursive: true });

		const shardA = path.join(checkpointDir, 'group1-shard1of2.bin');
		const shardB = path.join(checkpointDir, 'group1-shard2of2.bin');
		writeFileSync(shardA, Buffer.from([1, 2, 3]));
		writeFileSync(shardB, Buffer.from([4, 5]));

		writeFileSync(
			path.join(checkpointDir, 'model.json'),
			JSON.stringify({
				modelTopology: { model_config: {} },
				weightsManifest: [
					{
						paths: ['group1-shard1of2.bin', 'group1-shard2of2.bin'],
						weights: [{ name: 'x', shape: [5], dtype: 'float32' }]
					}
				]
			})
		);

		const artifacts = readModelArtifactsFromCheckpoint(checkpointDir);
		expect(artifacts.modelTopology).toBeDefined();
		expect(artifacts.weightSpecs).toHaveLength(1);
		expect(artifacts.weightData).toBeInstanceOf(ArrayBuffer);
		expect((artifacts.weightData as ArrayBuffer).byteLength).toBe(5);

		rmSync(tempDir, { recursive: true, force: true });
	});
});
