# TensorFlow.js Integration — AlphaZero-lite Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Intégrer TensorFlow.js pour remplacer les rollouts heuristiques du MCTS par un réseau conv-résiduel léger (tête politique + tête valeur), avec un pipeline offline self-play → entraînement → checkpoint, et un `ModelManager` utilisé au démarrage du serveur.

**Architecture:**

- Le MCTS accepte un `ModelAdapter` optionnel ; sans lui, il reste identique à l'actuel (rollout heuristique). Avec lui, il utilise PUCT au lieu d'UCB1 et remplace le rollout par la tête valeur.
- Un `TfjsModelAdapter` concret wrap un modèle TF.js chargé depuis `checkpoints/model/`.
- Le serveur démarre en important `src/hooks.server.ts` qui charge le checkpoint ; si absent, il lève une erreur fatale.
- `move-index.ts` centralise le mapping `PlayerMove ↔ indice entier` (320 actions : 64 placements + 256 déplacements sur grille 4×4).
- Le pipeline offline enrichit `training.ts` avec l'export de distributions MCTS et l'entraînement TF.js.

**Tech Stack:** TypeScript, TensorFlow.js Node (`@tensorflow/tfjs-node`), Vitest, tsx, SvelteKit 2.

---

### Task 1 : Indexation des coups (`move-index.ts`)

**Contexte :** Le réseau émet 320 logits. Il faut un mapping bijectif stable `PlayerMove ↔ [0, 319]`.

- Indices 0–63 : `place:pawn|rook|knight|bishop × 16 cases` (4 pieces × 16 cells, row-major)
- Indices 64–319 : `move:from×to` → les 256 paires (16×16), order row-major sur `from` puis `to`

**Files:**

- Create: `src/lib/server/ai/move-index.ts`
- Test: `src/lib/server/ai/move-index.spec.ts`

**Step 1 : Écrire les tests**

```ts
import { moveToIndex, indexToMove, MOVE_SPACE_SIZE } from './move-index';
import { describe, it, expect } from 'vitest';

describe('move-index', () => {
	it('MOVE_SPACE_SIZE is 320', () => {
		expect(MOVE_SPACE_SIZE).toBe(320);
	});

	it('place move round-trips', () => {
		const m = { kind: 'place' as const, piece: 'rook' as const, to: { x: 2, y: 3 } };
		expect(indexToMove(moveToIndex(m))).toEqual(m);
	});

	it('move move round-trips', () => {
		const m = { kind: 'move' as const, from: { x: 0, y: 0 }, to: { x: 3, y: 3 } };
		expect(indexToMove(moveToIndex(m))).toEqual(m);
	});

	it('all 320 indices decode to unique moves', () => {
		const seen = new Set<string>();
		for (let i = 0; i < MOVE_SPACE_SIZE; i++) {
			const key = JSON.stringify(indexToMove(i));
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});
});
```

**Step 2 : Vérifier que les tests échouent**

```
pnpm test -- --run src/lib/server/ai/move-index.spec.ts
```

Attendu : FAIL (module introuvable).

**Step 3 : Implémenter `move-index.ts`**

```ts
import { BOARD_SIZE, PIECES, type PieceType, type PlayerMove } from '$lib/types/game';

export const MOVE_SPACE_SIZE =
	PIECES.length * BOARD_SIZE * BOARD_SIZE + (BOARD_SIZE * BOARD_SIZE) ** 2;
// 4 * 16 + 256 = 320

export function moveToIndex(move: PlayerMove): number {
	if (move.kind === 'place') {
		const pieceIdx = PIECES.indexOf(move.piece as PieceType);
		return pieceIdx * BOARD_SIZE * BOARD_SIZE + move.to.y * BOARD_SIZE + move.to.x;
	}
	const fromIdx = move.from.y * BOARD_SIZE + move.from.x;
	const toIdx = move.to.y * BOARD_SIZE + move.to.x;
	return PIECES.length * BOARD_SIZE * BOARD_SIZE + fromIdx * BOARD_SIZE * BOARD_SIZE + toIdx;
}

export function indexToMove(idx: number): PlayerMove {
	const placeCount = PIECES.length * BOARD_SIZE * BOARD_SIZE;
	if (idx < placeCount) {
		const pieceIdx = Math.floor(idx / (BOARD_SIZE * BOARD_SIZE));
		const cell = idx % (BOARD_SIZE * BOARD_SIZE);
		return {
			kind: 'place',
			piece: PIECES[pieceIdx],
			to: { x: cell % BOARD_SIZE, y: Math.floor(cell / BOARD_SIZE) }
		};
	}
	const rem = idx - placeCount;
	const fromIdx = Math.floor(rem / (BOARD_SIZE * BOARD_SIZE));
	const toIdx = rem % (BOARD_SIZE * BOARD_SIZE);
	return {
		kind: 'move',
		from: { x: fromIdx % BOARD_SIZE, y: Math.floor(fromIdx / BOARD_SIZE) },
		to: { x: toIdx % BOARD_SIZE, y: Math.floor(toIdx / BOARD_SIZE) }
	};
}
```

**Step 4 : Vérifier que les tests passent**

```
pnpm test -- --run src/lib/server/ai/move-index.spec.ts
```

**Step 5 : Commit**

```
git add src/lib/server/ai/move-index.ts src/lib/server/ai/move-index.spec.ts
git commit -m "feat(ai): move-index — bijective PlayerMove <-> int mapping (320 actions)"
```

---

### Task 2 : Interface `ModelAdapter` + intégration MCTS (PUCT)

**Contexte :** `mcts.ts` doit accepter un `ModelAdapter` optionnel. Sans lui : comportement UCB1 + rollout heuristique inchangé. Avec lui : PUCT + évaluation feuille par la tête valeur (le rollout est remplacé).

Les formules changent :

- Score UCB1 actuel : $Q + c\sqrt{\ln N_p / N}$
- Score PUCT : $Q + c_{puct} \cdot P \cdot \sqrt{N_p} / (1 + N)$

où $P$ est le prior de la politique. Les priors sont initialisés à `1/n_moves` si pas d'adapter.

**Files:**

- Modify: `src/lib/server/ai/mcts.ts`
- Test: `src/lib/server/ai/agent.spec.ts` (ajouter un cas avec mock adapter)

**Step 1 : Ajouter un test avec mock adapter**

Dans `agent.spec.ts`, ajouter :

```ts
import { runMcts, type ModelAdapter } from './mcts';

it('mcts uses model adapter value head instead of rollout', async () => {
	const state = createTestState(); // état de début existant dans le fichier
	const mockAdapter: ModelAdapter = {
		priors: async (_s, moves) => moves.map(() => 1 / moves.length),
		value: async (_s, _color) => 0.9 // faveur massive pour le joueur courant
	};
	const move = await runMcts(state, 'white', { simulations: 10, modelAdapter: mockAdapter });
	expect(move).not.toBeNull();
});
```

**Step 2 : Vérifier que le test échoue**

```
pnpm test -- --run src/lib/server/ai/agent.spec.ts
```

Attendu : FAIL (type `ModelAdapter` inexistant, `runMcts` pas async).

**Step 3 : Modifier `mcts.ts`**

- Exporter `ModelAdapter` :

```ts
export interface ModelAdapter {
	priors(state: GameState, moves: PlayerMove[]): Promise<number[]>;
	value(state: GameState, color: Color): Promise<number>;
}
```

- Ajouter `modelAdapter?: ModelAdapter` à `MctsOptions`.
- Rendre `runMcts` async.
- Si adapter présent :
  - Remplacer `rollout()` par `await adapter.value(leafState, color)` (retourne `number` dans [-1,1]).
  - Initialiser les priors enfants depuis `adapter.priors()` à l'expansion.
  - Remplacer `ucb1()` par `puct()` : $Q + c \cdot P \cdot \sqrt{N_p} / (1 + N)$.
- Si adapter absent : comportement actuel inchangé (rollout sync enveloppé dans `Promise.resolve`).

> Important : le fast-path de coup gagnant immédiat reste en place dans tous les cas.

**Step 4 : Adapter `agent.ts`**

`chooseAiMove` devient `async` et propage `mctsOptions` incluant éventuellement `modelAdapter`.

**Step 5 : Adapter `game-store.ts`**

Les appels `chooseAiMove(...)` passent en `await chooseAiMove(...)` ; `applyAiTurns` devient `async`.

**Step 6 : Adapter `training.ts`**

`playSelfPlayGame` et `runSelfPlayBatch` deviennent `async`. Les appels à `chooseAiMove` passent en `await`.

**Step 7 : Vérifier que tous les tests passent**

```
pnpm test -- --run src/lib/server/ai/
```

**Step 8 : Commit**

```
git add src/lib/server/ai/mcts.ts src/lib/server/ai/agent.ts \
        src/lib/server/game-store.ts src/lib/server/ai/training.ts \
        src/lib/server/ai/agent.spec.ts
git commit -m "feat(ai): ModelAdapter interface + PUCT in MCTS, async chooseAiMove"
```

---

### Task 3 : Réseau TF.js (`model.ts`)

**Contexte :** `model.ts` contient la définition du réseau conv-résiduel léger, le `TfjsModelAdapter` concret, et le `ModelManager` singleton qui charge le checkpoint depuis le disque.

**Architecture du réseau :**

- Input spatial : `[batch, 4, 4, 10]` (reshape des 160 premières features de l'encoder)
- Input global : `[batch, 10]` (les 10 features restantes)
- Corps : `Conv2D(32, 3×3, padding='same') → BN → ReLU → ResBlock × 2 → Flatten → concat(global) → Dense(64) → ReLU`
- Tête politique : `Dense(320) → softmax`
- Tête valeur : `Dense(1) → tanh`

Le checkpoint TF.js est sauvegardé dans `checkpoints/model/` (fichiers `model.json` + binaires TF.js standard).

**Files:**

- Create: `src/lib/server/ai/model.ts`
- Create: `src/lib/server/ai/model.spec.ts`

**Step 1 : Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildModel, ModelManager, TfjsModelAdapter } from './model';
import { createInitialBoard } from '$lib/server/game-engine';
import { makeEmptyReserve } from '$lib/types/game';

describe('model', () => {
	it('buildModel returns a LayersModel with two outputs', () => {
		const model = buildModel();
		expect(model.outputs).toHaveLength(2);
	});

	it('TfjsModelAdapter.priors returns array of correct length', async () => {
		const model = buildModel();
		const adapter = new TfjsModelAdapter(model);
		const state = makeTestState(); // helper identique aux autres spec
		const moves = [{ kind: 'place' as const, piece: 'pawn' as const, to: { x: 0, y: 0 } }];
		const priors = await adapter.priors(state, moves);
		expect(priors).toHaveLength(1);
		expect(priors[0]).toBeGreaterThan(0);
	});

	it('TfjsModelAdapter.value returns number in [-1, 1]', async () => {
		const model = buildModel();
		const adapter = new TfjsModelAdapter(model);
		const state = makeTestState();
		const v = await adapter.value(state, 'white');
		expect(v).toBeGreaterThanOrEqual(-1);
		expect(v).toBeLessThanOrEqual(1);
	});

	it('ModelManager.getAdapter returns null before load', () => {
		expect(ModelManager.getAdapter()).toBeNull();
	});
});
```

Note : `makeTestState()` peut être extrait dans `src/lib/server/ai/test-helpers.ts` et partagé entre les spec.

**Step 2 : Vérifier que les tests échouent**

```
pnpm test -- --run src/lib/server/ai/model.spec.ts
```

Attendu : FAIL (module introuvable / `@tensorflow/tfjs-node` absent).

**Step 3 : Installer la dépendance**

```
pnpm add -D @tensorflow/tfjs-node
```

**Step 4 : Implémenter `model.ts`**

```ts
import * as tf from '@tensorflow/tfjs-node';
import { encodeState, ENCODING_SIZE } from './encoder';
import { moveToIndex, MOVE_SPACE_SIZE } from './move-index';
import type { Color, GameState, PlayerMove } from '$lib/types/game';
import type { ModelAdapter } from './mcts';

const SPATIAL_CHANNELS = 10;
const BOARD_SIZE = 4;
const SPATIAL_SIZE = BOARD_SIZE * BOARD_SIZE * SPATIAL_CHANNELS; // 160
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
		const [policyTensor] = this.runInference(state);
		const policyData = (await policyTensor.data()) as Float32Array;
		policyTensor.dispose();
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
	private loaded = false;

	async load(checkpointPath: string): Promise<void> {
		const model = await tf.loadLayersModel(`file://${checkpointPath}/model.json`);
		this.adapter = new TfjsModelAdapter(model);
		this.loaded = true;
		console.info(`[AI] Model loaded from ${checkpointPath}`);
	}

	getAdapter(): TfjsModelAdapter | null {
		return this.adapter;
	}

	isLoaded(): boolean {
		return this.loaded;
	}
}

export const ModelManager = new _ModelManager();
```

**Step 5 : Vérifier que les tests passent**

```
pnpm test -- --run src/lib/server/ai/model.spec.ts
```

**Step 6 : Vérifier que les tests existants restent verts**

```
pnpm test -- --run src/lib/server/ai/
```

**Step 7 : Commit**

```
git add src/lib/server/ai/model.ts src/lib/server/ai/model.spec.ts package.json pnpm-lock.yaml
git commit -m "feat(ai): TfjsModelAdapter + ModelManager + conv-residual network definition"
```

---

### Task 4 : Démarrage serveur avec checkpoint obligatoire (`hooks.server.ts`)

**Contexte :** SvelteKit exécute `src/hooks.server.ts` avant tout handler. C'est là qu'on charge le checkpoint ; si absent, le processus s'arrête.

`AI_CHECKPOINT_PATH` est lu depuis `process.env.AI_CHECKPOINT_PATH` (défaut : `checkpoints/model`).

**Files:**

- Create: `src/hooks.server.ts`

**Step 1 : Implémenter `hooks.server.ts`**

```ts
import { ModelManager } from '$lib/server/ai/model';
import path from 'node:path';
import fs from 'node:fs';

const checkpointPath = process.env.AI_CHECKPOINT_PATH ?? 'checkpoints/model';
const absolutePath = path.resolve(checkpointPath);

if (!fs.existsSync(path.join(absolutePath, 'model.json'))) {
	throw new Error(
		`[AI] Checkpoint introuvable : ${absolutePath}/model.json\n` +
			`Lancez d'abord : pnpm ai:auto-train`
	);
}

await ModelManager.load(absolutePath);
```

**Step 2 : Vérifier que le serveur démarre normalement** (avec checkpoint) et **s'arrête avec message clair** (sans checkpoint)

```bash
# Sans checkpoint — doit échouer proprement :
pnpm build && node -e "import('./build/index.js')" 2>&1 | head -5

# Pour tester avec checkpoint : cf. Task 6 (pipeline d'entraînement)
```

**Step 3 : Injecter l'adapter dans `game-store.ts`**

Dans `applyAiTurns`, passer l'adapter au MCTS :

```ts
import { ModelManager } from './ai/model';

// dans applyAiTurns :
const adapter = ModelManager.getAdapter() ?? undefined;
const move = await chooseAiMove(record.state, aiColor, { modelAdapter: adapter });
```

**Step 4 : Vérifier que les tests existants passent toujours**

```
pnpm test
```

> Les tests unitaires de `game-store.spec.ts` tournent sans checkpoint — `ModelManager.getAdapter()` retourne `null`, l'agent revient au mode heuristique, ce qui est le comportement attendu.

**Step 5 : Commit**

```
git add src/hooks.server.ts src/lib/server/game-store.ts
git commit -m "feat(ai): load TF.js checkpoint at server startup, inject adapter into MCTS"
```

---

### Task 5 : Pipeline d'entraînement TF.js (enrichissement de `training.ts`)

**Contexte :** Le pipeline offline doit :

1. Collecter des triplets `(encoded_state, mcts_distribution, outcome)` durant l'auto-jeu.
2. Entraîner le réseau sur ces triplets (policy loss = cross-entropy, value loss = MSE).
3. Sauvegarder le checkpoint dans `checkpoints/model/`.

**Files:**

- Modify: `src/lib/server/ai/training.ts`
- Create: `scripts/ai/train-network.ts` (nouveau script TF.js, distinct du `train.ts` existant)
- Modify: `package.json` (nouveau script `ai:train-network`)
- Modify: `src/lib/server/ai/training.spec.ts` (assert que les samples sont collectés)

**Step 1 : Ajouter la collecte de samples dans `training.ts`**

Ajouter un type :

```ts
export interface TrainingSample {
	encoded: Float32Array; // ENCODING_SIZE floats
	mctsDistribution: Float32Array; // MOVE_SPACE_SIZE floats (distribution lissée des visites)
	outcome: number; // +1 blanc gagne, -1 noir gagne, 0 nul
}
```

Dans `playSelfPlayGame`, à chaque coup :

- Appeler `encodeState(state, actor)` avant d'appliquer le coup.
- Construire `mctsDistribution` en normalisant les visites de la racine MCTS sur les 320 actions.
- Stocker `{ encoded, mctsDistribution, outcome: ?? }` dans un tableau.
- Remplir `outcome` a posteriori quand le résultat est connu.

Ajouter `samples: TrainingSample[]` à `SelfPlayBatchReport`.

**Step 2 : Ajouter un test pour la collecte de samples**

Dans `training.spec.ts` :

```ts
it(
	'self-play batch collects training samples',
	async () => {
		const report = await runSelfPlayBatch({ games: 1, maxPlies: 30 });
		expect(report.samples.length).toBeGreaterThan(0);
		expect(report.samples[0].encoded).toHaveLength(ENCODING_SIZE);
		expect(report.samples[0].mctsDistribution).toHaveLength(MOVE_SPACE_SIZE);
	},
	{ timeout: 60_000 }
);
```

**Step 3 : Vérifier que le test échoue puis passer au vert**

```
pnpm test -- --run src/lib/server/ai/training.spec.ts
```

**Step 4 : Créer `scripts/ai/train-network.ts`**

```ts
// Usage: pnpm ai:train-network [-- --dataset=artifacts/ai/dataset.jsonl --output=checkpoints/model --epochs=10]
import * as tf from '@tensorflow/tfjs-node';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { buildModel } from '../../src/lib/server/ai/model';
import { ENCODING_SIZE, SPATIAL_SIZE } from '../../src/lib/server/ai/encoder';
import { MOVE_SPACE_SIZE } from '../../src/lib/server/ai/move-index';

// Parse CLI args
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace('--', '').split('=')));
const datasetPath = args.dataset ?? 'artifacts/ai/dataset.jsonl';
const outputPath = args.output ?? 'checkpoints/model';
const epochs = Number(args.epochs ?? 10);
const batchSize = Number(args.batch ?? 64);

// Load dataset
const samples = [];
const rl = readline.createInterface({ input: fs.createReadStream(datasetPath) });
for await (const line of rl) {
	if (line.trim()) samples.push(JSON.parse(line));
}

const n = samples.length;
const spatialData = new Float32Array(n * 4 * 4 * 10);
const globalData = new Float32Array(n * (ENCODING_SIZE - 4 * 4 * 10));
const policyTarget = new Float32Array(n * MOVE_SPACE_SIZE);
const valueTarget = new Float32Array(n);

for (let i = 0; i < n; i++) {
	const s = samples[i];
	spatialData.set(s.encoded.slice(0, 4 * 4 * 10), i * 4 * 4 * 10);
	globalData.set(s.encoded.slice(4 * 4 * 10), i * (ENCODING_SIZE - 4 * 4 * 10));
	policyTarget.set(s.mctsDistribution, i * MOVE_SPACE_SIZE);
	valueTarget[i] = s.outcome;
}

const xSpatial = tf.tensor4d(spatialData, [n, 4, 4, 10]);
const xGlobal = tf.tensor2d(globalData, [n, ENCODING_SIZE - 4 * 4 * 10]);
const yPolicy = tf.tensor2d(policyTarget, [n, MOVE_SPACE_SIZE]);
const yValue = tf.tensor2d(valueTarget, [n, 1]);

let model: tf.LayersModel;
const modelJsonPath = path.join(outputPath, 'model.json');
if (fs.existsSync(modelJsonPath)) {
	model = await tf.loadLayersModel(`file://${modelJsonPath}`);
	console.log('Reprise depuis checkpoint existant.');
} else {
	model = buildModel();
	console.log('Nouveau modèle créé.');
}

model.compile({
	optimizer: tf.train.adam(1e-3),
	loss: { policy: 'categoricalCrossentropy', value: 'meanSquaredError' },
	lossWeights: { policy: 1, value: 1 }
});

await model.fit([xSpatial, xGlobal], [yPolicy, yValue], { epochs, batchSize });

fs.mkdirSync(outputPath, { recursive: true });
await model.save(`file://${outputPath}`);
console.log(`Checkpoint sauvegardé dans ${outputPath}`);
```

**Step 5 : Ajouter le script `ai:train-network` dans `package.json`**

```json
"ai:train-network": "tsx scripts/ai/train-network.ts"
```

**Step 6 : Mettre à jour `ai:auto-train`** dans `scripts/ai/auto-train.ts` pour enchaîner self-play → train-network.

**Step 7 : Vérifier que tous les tests passent**

```
pnpm test
```

**Step 8 : Commit**

```
git add src/lib/server/ai/training.ts src/lib/server/ai/training.spec.ts \
        scripts/ai/train-network.ts package.json pnpm-lock.yaml
git commit -m "feat(ai): collect MCTS training samples, train-network script for TF.js offline training"
```

---

### Task 6 : Vérification finale et documentation

**Files:**

- Modify: `README.md`
- Modify: `checkpoints/.gitkeep` (créer si absent)

**Step 1 : Générer un premier checkpoint pour pouvoir démarrer le serveur**

```bash
# Générer 5 parties pour créer un dataset minimal
pnpm ai:self-play -- --games=5 --max-plies=100

# Entraîner 2 époques pour créer le premier checkpoint
pnpm ai:train-network -- --epochs=2

# Vérifier que checkpoints/model/model.json existe
ls checkpoints/model/
```

**Step 2 : S'assurer que le serveur démarre sans erreur**

```bash
pnpm build && pnpm preview
# Attendre "Model loaded from checkpoints/model" dans les logs
```

**Step 3 : Lancer la vérification complète**

```
pnpm check && pnpm lint && pnpm test
```

Attendu : 0 erreurs, 0 avertissements, tous les tests verts.

**Step 4 : Mettre à jour `README.md`**

Mettre à jour la section IA :

- Documenter `pnpm ai:self-play` → collecte dataset
- Documenter `pnpm ai:train-network` → entraîne réseau TF.js
- Documenter `pnpm ai:auto-train` → boucle complète
- Indiquer que le checkpoint `checkpoints/model/` doit exister avant de démarrer le serveur

**Step 5 : Créer `checkpoints/.gitkeep`**

```bash
mkdir -p checkpoints
touch checkpoints/.gitkeep
echo "checkpoints/model/" >> .gitignore   # ne pas versionner les poids
```

**Step 6 : Commit final**

```
git add README.md checkpoints/.gitkeep .gitignore
git commit -m "docs(ai): document TF.js pipeline and checkpoint requirement"
```
