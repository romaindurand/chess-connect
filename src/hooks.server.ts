import fs from 'node:fs';
import path from 'node:path';

import { ModelManager } from '$lib/server/ai/model';

const checkpointPath = process.env.AI_CHECKPOINT_PATH ?? 'checkpoints/model';
const absolutePath = path.resolve(checkpointPath);

if (!fs.existsSync(path.join(absolutePath, 'model.json'))) {
	throw new Error(
		`[AI] Checkpoint introuvable : ${absolutePath}/model.json\n` +
			`Lancez d'abord : pnpm ai:train-network -- --dataset=artifacts/ai/self-play.json --output=checkpoints/model`
	);
}

await ModelManager.load(absolutePath);
