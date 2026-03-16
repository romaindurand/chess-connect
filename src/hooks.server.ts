import fs from 'node:fs';
import path from 'node:path';

import { ModelManager } from '$lib/server/ai/model';
import { initializeBestRuntimeBackend } from '$lib/server/ai/tf-runtime';

const checkpointPath = process.env.AI_CHECKPOINT_PATH ?? 'checkpoints/model';
const absolutePath = path.resolve(checkpointPath);

if (!fs.existsSync(path.join(absolutePath, 'model.json'))) {
	throw new Error(
		`[AI] Checkpoint introuvable : ${absolutePath}/model.json\n` +
			`Lancez d'abord : pnpm ai:train-network -- --dataset=artifacts/ai/self-play.json --output=checkpoints/model`
	);
}

const runtimeBackend = await initializeBestRuntimeBackend();
if (runtimeBackend.fallbackReason) {
	console.warn(
		`[AI] Backend tensorflow indisponible. Fallback automatique sur cpu/js. Détail: ${runtimeBackend.fallbackReason}`
	);
}
console.info(`[AI] Backend TF runtime: ${runtimeBackend.backend}`);

await ModelManager.load(absolutePath);
