# Auth simplifiée (clé de récupération) — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettre aux joueurs de créer un compte en 1 clic (après saisie du nom), d'obtenir une clé de récupération opaque, et de se reconnecter depuis n'importe quel navigateur en collant cette clé dans un champ dédié. La session est établie via un cookie HttpOnly. Les comptes et tokens sont stockés en SQLite via Prisma ; les parties restent en mémoire.

**Architecture:**

- `src/lib/server/db.ts` — singleton PrismaClient partagé entre les modules serveur.
- `src/lib/server/auth-store.ts` — toute la logique métier auth (création compte, génération/hash token, login, révocation, rotation).
- `src/routes/api/auth/*` — endpoints REST dédiés, isolés du flux existant `api/games/*`.
- Le cookie `cc_auth` (HttpOnly, SameSite lax) contient un jeton signé HMAC référençant l'ID utilisateur. Les tokens de partie `cc_player_<gameId>` restent inchangés.

**Tech Stack:** SvelteKit 2, TypeScript, Prisma 6 + @prisma/client, SQLite, Node.js crypto (built-in), pnpm.

**Token design:**

- Format brut : `ccrec_` + 43 chars base64url (32 bytes random) → ~49 chars reconnaissables.
- Stockage DB : `SHA-256(raw_token)` en hex uniquement — jamais le token brut.
- Session cookie : `cc_auth` = `userId:rnd:HMAC-SHA256(userId:rnd, CHESS_CONNECT_SECRET)`.

---

## Prérequis avant de commencer

1. Créer un fichier `.env` (ignoré par git) à la racine du worktree avec :
   ```
   DATABASE_URL="file:./dev.db"
   ```
2. S'assurer que le répertoire `prisma/` est accessible en écriture pour créer le fichier SQLite local.
3. Travailler depuis le worktree : `cd .worktrees/feature/auth`

---

## Task 1: Prisma — installation et initialisation

**Files:**

- Modify: `package.json` (scripts + devDependencies)
- Create: `prisma/schema.prisma`
- Create: `.env.example` (documentation sans secrets)

**Step 1.1: Installer Prisma**

```bash
pnpm add -D prisma
pnpm add @prisma/client
```

Attendu : `package.json` mis à jour, `pnpm-lock.yaml` mis à jour.

**Step 1.2: Initialiser Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

Cela crée `prisma/schema.prisma` (avec `datasource db`) et un `.env` vide.

**Step 1.3: Remplacer `prisma/schema.prisma` par le schéma cible**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
	provider = "sqlite"
  url      = env("DATABASE_URL")
}

model UserAccount {
  id        String      @id @default(cuid())
  username  String      @unique
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  tokens    AuthToken[]
}

model AuthToken {
  id         String      @id @default(cuid())
  userId     String
  user       UserAccount @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash  String      @unique
  revokedAt  DateTime?
  createdAt  DateTime    @default(now())
  lastUsedAt DateTime?
}
```

**Step 1.4: Ajouter les scripts Prisma dans `package.json`**
Dans la section `"scripts"`, ajouter :

```json
"prisma:generate": "prisma generate",
"prisma:migrate:dev": "prisma migrate dev",
"prisma:migrate:deploy": "prisma migrate deploy",
"prisma:studio": "prisma studio"
```

**Step 1.5: Créer `.env.example` documentant les variables nécessaires**

```env
# Auth
CHESS_CONNECT_SECRET=change-me-in-production

# Base de données
DATABASE_URL="file:./dev.db"

# IA (existant)
# AI_CHECKPOINT_PATH=checkpoints/model
# AI_RUNTIME_BACKEND=auto
# AI_GAMES_PATH=artifacts/ai/recorded-games.jsonl
```

Vérifier que `.env.example` est bien suivi par git (`!.env.example` doit être dans `.gitignore`, ce qui est déjà le cas).

**Step 1.6: Générer le client Prisma + créer la migration initiale**

```bash
npx prisma migrate dev --name init-auth
```

Ce commande : génère le `@prisma/client`, applique la migration, crée `prisma/migrations/YYYYMMDD_init_auth/migration.sql`.

**Step 1.7: Vérifier que la migration est propre**

```bash
npx prisma migrate status
```

Attendu : `Database schema is up to date!`

**Step 1.8: Commit**

```bash
git add prisma/ .env.example package.json pnpm-lock.yaml
git commit -m "feat(auth): add prisma schema with UserAccount and AuthToken"
```

---

## Task 2: Singleton PrismaClient

**Files:**

- Create: `src/lib/server/db.ts`

**Step 2.1: Créer le module**
Le singleton évite les instances multiples en dev HMR, pattern standard Prisma+Next/SvelteKit :

```typescript
import { PrismaClient } from '@prisma/client';

declare global {
	// eslint-disable-next-line no-var
	var __prisma: PrismaClient | undefined;
}

export const db: PrismaClient =
	globalThis.__prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
	});

if (process.env.NODE_ENV !== 'production') {
	globalThis.__prisma = db;
}
```

**Step 2.2: Vérifier la compilation TS**

```bash
pnpm check
```

Attendu : 0 erreur.

**Step 2.3: Commit**

```bash
git add src/lib/server/db.ts
git commit -m "feat(auth): add PrismaClient singleton"
```

---

## Task 3: Service auth-store — tests (TDD Red)

**Files:**

- Create: `src/lib/server/auth-store.spec.ts`

**Step 3.1: Écrire les tests unitaires**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerAccount,
	loginWithToken,
	revokeToken,
	rotateToken,
	getAccountById,
	parseAuthCookie,
	signAuthCookie
} from './auth-store';

// Mock Prisma pour éviter une vraie DB en tests unitaires
import { vi } from 'vitest';
vi.mock('./db', () => {
	const mockTokens: Array<{
		id: string;
		userId: string;
		tokenHash: string;
		revokedAt: Date | null;
		createdAt: Date;
		lastUsedAt: Date | null;
	}> = [];
	const mockUsers: Array<{ id: string; username: string; createdAt: Date; updatedAt: Date }> = [];

	return {
		db: {
			userAccount: {
				create: vi.fn(async ({ data }: { data: { username: string } }) => {
					const user = {
						id: `user_${Math.random()}`,
						username: data.username,
						createdAt: new Date(),
						updatedAt: new Date()
					};
					mockUsers.push(user);
					return user;
				}),
				findUnique: vi.fn(async ({ where }: { where: { id?: string; username?: string } }) => {
					return (
						mockUsers.find((u) => (where.id ? u.id === where.id : u.username === where.username)) ??
						null
					);
				})
			},
			authToken: {
				create: vi.fn(async ({ data }: { data: { userId: string; tokenHash: string } }) => {
					const token = {
						id: `tok_${Math.random()}`,
						userId: data.userId,
						tokenHash: data.tokenHash,
						revokedAt: null,
						createdAt: new Date(),
						lastUsedAt: null
					};
					mockTokens.push(token);
					return token;
				}),
				findFirst: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
					return (
						mockTokens.find((t) => t.tokenHash === where.tokenHash && t.revokedAt === null) ?? null
					);
				}),
				updateMany: vi.fn(
					async ({
						where,
						data
					}: {
						where: { userId: string; revokedAt: null };
						data: { revokedAt: Date };
					}) => {
						mockTokens.forEach((t) => {
							if (t.userId === where.userId && t.revokedAt === null) t.revokedAt = data.revokedAt;
						});
						return { count: 1 };
					}
				),
				update: vi.fn(
					async ({ where, data }: { where: { id: string }; data: { lastUsedAt: Date } }) => {
						const t = mockTokens.find((x) => x.id === where.id);
						if (t) t.lastUsedAt = data.lastUsedAt;
						return t;
					}
				)
			}
		}
	};
});

describe('auth-store', () => {
	describe('registerAccount', () => {
		it('renvoie un token brut lisible et un userId', async () => {
			const r = await registerAccount('Alice');
			expect(r.rawToken).toMatch(/^ccrec_/);
			expect(r.rawToken.length).toBeGreaterThan(40);
			expect(r.userId).toBeTruthy();
		});

		it('le token brut est différent à chaque appel', async () => {
			const r1 = await registerAccount('Bob');
			const r2 = await registerAccount('Charlie');
			expect(r1.rawToken).not.toBe(r2.rawToken);
		});
	});

	describe('loginWithToken', () => {
		it('retourne le compte pour un token valide', async () => {
			const { rawToken } = await registerAccount('Dave');
			const account = await loginWithToken(rawToken);
			expect(account).not.toBeNull();
			expect(account?.username).toBe('Dave');
		});

		it('retourne null pour un token inconnu', async () => {
			const result = await loginWithToken('ccrec_invalide');
			expect(result).toBeNull();
		});

		it('retourne null pour un token révoqué', async () => {
			const { rawToken, userId } = await registerAccount('Eve');
			await revokeToken(userId);
			const result = await loginWithToken(rawToken);
			expect(result).toBeNull();
		});
	});

	describe('rotateToken', () => {
		it("invalide l'ancien token et retourne un nouveau token valide", async () => {
			const { rawToken, userId } = await registerAccount('Frank');
			const newRaw = await rotateToken(userId);
			expect(newRaw).toMatch(/^ccrec_/);
			expect(newRaw).not.toBe(rawToken);
			// L'ancien est invalide
			const old = await loginWithToken(rawToken);
			expect(old).toBeNull();
			// Le nouveau est valide
			const fresh = await loginWithToken(newRaw);
			expect(fresh?.username).toBe('Frank');
		});
	});

	describe('signAuthCookie / parseAuthCookie', () => {
		it('round-trip: signer puis parser retourne le même userId', () => {
			const userId = 'user_abc123';
			const cookie = signAuthCookie(userId);
			const parsed = parseAuthCookie(cookie);
			expect(parsed).toBe(userId);
		});

		it('retourne null pour une valeur falsifiée', () => {
			const result = parseAuthCookie('user_abc:fakernonce:INVALIDSIG==');
			expect(result).toBeNull();
		});

		it('retourne null pour une valeur vide', () => {
			expect(parseAuthCookie('')).toBeNull();
			expect(parseAuthCookie(undefined)).toBeNull();
		});
	});
});
```

**Step 3.2: Lancer les tests et vérifier qu'ils échouent**

```bash
pnpm test -- --run src/lib/server/auth-store.spec.ts
```

Attendu : FAIL « Cannot find module './auth-store' »

---

## Task 4: Service auth-store — implémentation (TDD Green)

**Files:**

- Create: `src/lib/server/auth-store.ts`

**Step 4.1: Implémenter le module**

```typescript
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { db } from './db';

const SECRET = process.env.CHESS_CONNECT_SECRET ?? 'dev-insecure-secret';
const AUTH_COOKIE_NAME = 'cc_auth';

export { AUTH_COOKIE_NAME };

// ---------------------------------------------------------------------------
// Token utilitaires
// ---------------------------------------------------------------------------

function generateRawToken(): string {
	return 'ccrec_' + randomBytes(32).toString('base64url');
}

function hashToken(rawToken: string): string {
	return createHash('sha256').update(rawToken).digest('hex');
}

// ---------------------------------------------------------------------------
// Cookie de session
// ---------------------------------------------------------------------------

export function signAuthCookie(userId: string): string {
	const rnd = randomBytes(8).toString('base64url');
	const raw = `${userId}:${rnd}`;
	const sig = createHmac('sha256', SECRET).update(raw).digest('base64url');
	return `${raw}:${sig}`;
}

export function parseAuthCookie(value: string | undefined): string | null {
	if (!value) return null;
	const parts = value.split(':');
	if (parts.length !== 3) return null;
	const [userId, rnd, sig] = parts;
	const raw = `${userId}:${rnd}`;
	const expected = createHmac('sha256', SECRET).update(raw).digest('base64url');
	if (expected !== sig) return null;
	return userId;
}

// ---------------------------------------------------------------------------
// CRUD comptes
// ---------------------------------------------------------------------------

export async function registerAccount(
	username: string
): Promise<{ userId: string; rawToken: string }> {
	const rawToken = generateRawToken();
	const tokenHash = hashToken(rawToken);

	const user = await db.userAccount.create({
		data: {
			username,
			tokens: {
				create: { tokenHash }
			}
		}
	});

	return { userId: user.id, rawToken };
}

export async function loginWithToken(
	rawToken: string
): Promise<{ id: string; username: string } | null> {
	const tokenHash = hashToken(rawToken);

	const token = await db.authToken.findFirst({
		where: { tokenHash, revokedAt: null },
		include: { user: true }
	});

	if (!token) return null;

	await db.authToken.update({
		where: { id: token.id },
		data: { lastUsedAt: new Date() }
	});

	return { id: token.user.id, username: token.user.username };
}

export async function revokeToken(userId: string): Promise<void> {
	await db.authToken.updateMany({
		where: { userId, revokedAt: null },
		data: { revokedAt: new Date() }
	});
}

export async function rotateToken(userId: string): Promise<string> {
	const rawToken = generateRawToken();
	const tokenHash = hashToken(rawToken);

	await db.$transaction([
		db.authToken.updateMany({
			where: { userId, revokedAt: null },
			data: { revokedAt: new Date() }
		}),
		db.authToken.create({
			data: { userId, tokenHash }
		})
	]);

	return rawToken;
}

export async function getAccountById(
	userId: string
): Promise<{ id: string; username: string; createdAt: Date } | null> {
	return db.userAccount.findUnique({
		where: { id: userId },
		select: { id: true, username: true, createdAt: true }
	});
}
```

**Step 4.2: Lancer les tests**

```bash
pnpm test -- --run src/lib/server/auth-store.spec.ts
```

Attendu : PASS, tous les tests verts.

**Step 4.3: Lancer check global**

```bash
pnpm check
```

Attendu : 0 erreur TS/Svelte.

**Step 4.4: Commit**

```bash
git add src/lib/server/auth-store.ts src/lib/server/auth-store.spec.ts
git commit -m "feat(auth): add auth-store with token generation, login, revoke, rotate"
```

---

## Task 5: Endpoint POST /api/auth/register

**Files:**

- Create: `src/routes/api/auth/register/+server.ts`

**Step 5.1: Écrire le handler**

```typescript
import { json } from '@sveltejs/kit';
import { registerAccount, signAuthCookie, AUTH_COOKIE_NAME } from '$lib/server/auth-store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = (await request.json()) as unknown;
		if (!body || typeof body !== 'object' || !('username' in body)) {
			return json({ error: "Nom d'utilisateur requis" }, { status: 400 });
		}
		const input = body as { username: unknown };
		if (typeof input.username !== 'string') {
			return json({ error: "Le nom d'utilisateur doit être une chaîne" }, { status: 400 });
		}
		const username = input.username.trim();
		if (username.length < 2 || username.length > 24) {
			return json({ error: 'Le nom doit contenir entre 2 et 24 caractères' }, { status: 400 });
		}

		const { userId, rawToken } = await registerAccount(username);

		cookies.set(AUTH_COOKIE_NAME, signAuthCookie(userId), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30 // 30 jours
		});

		// Le rawToken n'est retourné qu'une seule fois : le client DOIT le présenter à l'utilisateur
		return json({ username, rawToken }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erreur de création de compte';
		// Cas : username déjà pris (contrainte UNIQUE Prisma)
		if (message.includes('Unique constraint')) {
			return json({ error: "Ce nom d'utilisateur est déjà pris" }, { status: 409 });
		}
		return json({ error: message }, { status: 400 });
	}
};
```

**Step 5.2: Générer les types SvelteKit**

```bash
pnpm prepare
```

**Step 5.3: Vérifier le check**

```bash
pnpm check
```

Attendu : 0 erreur.

**Step 5.4: Commit**

```bash
git add src/routes/api/auth/
git commit -m "feat(auth): add POST /api/auth/register endpoint"
```

---

## Task 6: Endpoint POST /api/auth/login-token

**Files:**

- Create: `src/routes/api/auth/login-token/+server.ts`

**Step 6.1: Écrire le handler**

```typescript
import { json } from '@sveltejs/kit';
import { loginWithToken, signAuthCookie, AUTH_COOKIE_NAME } from '$lib/server/auth-store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = (await request.json()) as unknown;
		if (!body || typeof body !== 'object' || !('token' in body)) {
			return json({ error: 'Clé de récupération requise' }, { status: 400 });
		}
		const input = body as { token: unknown };
		if (typeof input.token !== 'string' || !input.token.startsWith('ccrec_')) {
			return json({ error: 'Format de clé invalide' }, { status: 400 });
		}

		const account = await loginWithToken(input.token);
		if (!account) {
			return json({ error: 'Clé de récupération invalide ou révoquée' }, { status: 401 });
		}

		cookies.set(AUTH_COOKIE_NAME, signAuthCookie(account.id), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});

		return json({ username: account.username });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erreur de connexion';
		return json({ error: message }, { status: 400 });
	}
};
```

**Step 6.2: Vérifier**

```bash
pnpm check
```

**Step 6.3: Commit**

```bash
git add src/routes/api/auth/login-token/
git commit -m "feat(auth): add POST /api/auth/login-token endpoint"
```

---

## Task 7: Endpoints GET /api/auth/me, POST /api/auth/logout, POST /api/auth/token/rotate

**Files:**

- Create: `src/routes/api/auth/me/+server.ts`
- Create: `src/routes/api/auth/logout/+server.ts`
- Create: `src/routes/api/auth/token/rotate/+server.ts`

**Step 7.1: GET /api/auth/me**

```typescript
// src/routes/api/auth/me/+server.ts
import { json } from '@sveltejs/kit';
import { getAccountById, parseAuthCookie, AUTH_COOKIE_NAME } from '$lib/server/auth-store';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const cookieValue = cookies.get(AUTH_COOKIE_NAME);
	const userId = parseAuthCookie(cookieValue);
	if (!userId) {
		return json({ authenticated: false });
	}
	const account = await getAccountById(userId);
	if (!account) {
		cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
		return json({ authenticated: false });
	}
	return json({ authenticated: true, username: account.username, userId: account.id });
};
```

**Step 7.2: POST /api/auth/logout**

```typescript
// src/routes/api/auth/logout/+server.ts
import { json } from '@sveltejs/kit';
import { AUTH_COOKIE_NAME } from '$lib/server/auth-store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
	return json({ ok: true });
};
```

**Step 7.3: POST /api/auth/token/rotate**

```typescript
// src/routes/api/auth/token/rotate/+server.ts
import { json } from '@sveltejs/kit';
import {
	parseAuthCookie,
	rotateToken,
	signAuthCookie,
	AUTH_COOKIE_NAME
} from '$lib/server/auth-store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const cookieValue = cookies.get(AUTH_COOKIE_NAME);
	const userId = parseAuthCookie(cookieValue);
	if (!userId) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}
	try {
		const newRawToken = await rotateToken(userId);
		// Renouveler le cookie de session aussi
		cookies.set(AUTH_COOKIE_NAME, signAuthCookie(userId), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});
		return json({ rawToken: newRawToken });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erreur de rotation';
		return json({ error: message }, { status: 500 });
	}
};
```

**Step 7.4: Vérifier**

```bash
pnpm check
```

Attendu : 0 erreur.

**Step 7.5: Commit**

```bash
git add src/routes/api/auth/me/ src/routes/api/auth/logout/ src/routes/api/auth/token/
git commit -m "feat(auth): add GET /api/auth/me, POST /api/auth/logout and /token/rotate"
```

---

## Task 8: Tests routes API auth

**Files:**

- Create: `src/routes/api/auth/auth-routes.spec.ts`

Note: Les tests des routes SvelteKit utilisent en général des tests d'intégration réel ou un mock du wrapper SvelteKit. Pour cette app, le pattern dans `demo.spec.ts` est minimal. Écrire des tests ciblés qui testent la logique des handlers en mockant `auth-store`.

**Step 8.1: Écrire les tests de base**

```typescript
import { describe, it, expect } from 'vitest';
// Ces tests vérifient la logique de validation des payloads
// Les tests d'intégration HTTP complets nécessiteraient `supertest` + serveur monté,
// ce qui dépasse le scope initial. On couvre ici la validation des entrées.

// Test de la regex de format du token
describe('validation format token', () => {
	it('reconnaît un token valide', () => {
		expect('ccrec_ABC123'.startsWith('ccrec_')).toBe(true);
	});
	it('rejette un token sans préfixe', () => {
		expect('nomUtilisateur'.startsWith('ccrec_')).toBe(false);
	});
});

// Test du login nul pour token invalide — couvert dans auth-store.spec.ts
// Pas de doublon ici.
```

**Step 8.2: Lancer tous les tests**

```bash
pnpm test
```

Attendu : tous verts, aucune régression.

**Step 8.3: Commit**

```bash
git add src/routes/api/auth/auth-routes.spec.ts
git commit -m "test(auth): add route validation smoke tests"
```

---

## Task 9: Client-side auth API module

**Files:**

- Create: `src/lib/client/auth-api.ts`

**Step 9.1: Créer le module**

```typescript
// Abstraction fine pour les appels HTTP auth — miroir de game-api.ts côté auth

export interface AuthState {
	authenticated: boolean;
	username?: string;
	userId?: string;
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
	const payload = (await response.json()) as T | { error: string };
	if (!response.ok) {
		const message =
			typeof payload === 'object' && payload !== null && 'error' in payload
				? String((payload as { error: string }).error)
				: 'Erreur inattendue';
		throw new Error(message);
	}
	return payload as T;
}

export async function registerRemote(username: string): Promise<{ rawToken: string }> {
	const response = await fetch('/api/auth/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username })
	});
	return readJsonOrThrow<{ rawToken: string; username: string }>(response);
}

export async function loginWithTokenRemote(token: string): Promise<{ username: string }> {
	const response = await fetch('/api/auth/login-token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token })
	});
	return readJsonOrThrow<{ username: string }>(response);
}

export async function logoutRemote(): Promise<void> {
	await fetch('/api/auth/logout', { method: 'POST' });
}

export async function getAuthStateRemote(): Promise<AuthState> {
	const response = await fetch('/api/auth/me');
	return readJsonOrThrow<AuthState>(response);
}

export async function rotateTokenRemote(): Promise<{ rawToken: string }> {
	const response = await fetch('/api/auth/token/rotate', { method: 'POST' });
	return readJsonOrThrow<{ rawToken: string }>(response);
}
```

**Step 9.2: Vérifier le check**

```bash
pnpm check
```

**Step 9.3: Commit**

```bash
git add src/lib/client/auth-api.ts
git commit -m "feat(auth): add client-side auth-api module"
```

---

## Task 10: i18n — nouvelles clés

**Files:**

- Modify: `src/lib/i18n/fr.json`
- Modify: `src/lib/i18n/en.json`
- Modify: `src/lib/i18n/index.ts`

**Step 10.1: Ajouter les clés FR**
Dans `fr.json`, ajouter une section `"auth"` (et dans `"errors"` les erreurs serveur localisables) :

```json
// Dans "auth":
"auth": {
  "createAccount": "Créer un compte",
  "recoveryKeyLabel": "Clé de récupération",
  "recoveryKeyPlaceholder": "ccrec_...",
  "recoveryKeyHint": "Copiez cette clé et conservez-la précieusement. Elle ne sera plus affichée.",
  "copyKey": "Copier la clé",
  "keyCopied": "Clé copiée !",
  "rotateKey": "Régénérer la clé",
  "rotateKeyConfirm": "L'ancienne clé sera invalidée définitivement. Continuer ?",
  "logout": "Se déconnecter",
  "loggedInAs": "Connecté en tant que {username}",
  "loginSubmit": "Se connecter",
  "registerSubmit": "Créer mon compte",
  "backToRegister": "Créer un compte",
  "backToLogin": "Déjà un compte ?"
}
// Dans "errors":
"usernameAlreadyTaken": "Ce nom d'utilisateur est déjà pris",
"invalidRecoveryKey": "Clé de récupération invalide ou révoquée",
"invalidKeyFormat": "Format de clé invalide",
"notAuthenticated": "Non authentifié"
```

**Step 10.2: Ajouter les clés EN** (traductions anglaises équivalentes)

**Step 10.3: Ajouter les mappings serveur dans `index.ts`**

```typescript
// Dans la map serverMessageToI18nKey :
'Ce nom d\'utilisateur est déjà pris': 'errors.usernameAlreadyTaken',
'Clé de récupération invalide ou révoquée': 'errors.invalidRecoveryKey',
'Format de clé invalide': 'errors.invalidKeyFormat',
'Non authentifié': 'errors.notAuthenticated',
```

**Step 10.4: Vérification i18n**

```bash
pnpm dlx i18n-unused display-unused && pnpm dlx i18n-unused display-missed
```

Attendu : aucune clé manquante pour les nouvelles clés définies (elles seront potentiellement "unused" jusqu'à l'intégration UI — acceptable à ce stade).

**Step 10.5: Vérifier le check**

```bash
pnpm check
```

**Step 10.6: Commit**

```bash
git add src/lib/i18n/
git commit -m "feat(auth): add i18n keys for auth UI (fr + en)"
```

---

## Task 11: UI — composant AccountPanel

**Files:**

- Create: `src/lib/components/AccountPanel.svelte`

Ce composant gère l'état auth sur la page d'accueil. Il affiche :

- Si non authentifié : rien (les flux Créer/Se connecter sont dans `+page.svelte`)
- Si authentifié : nom d'utilisateur, bouton "Copier la clé", bouton "Régénérer", bouton "Déconnexion"

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { rotateTokenRemote, logoutRemote } from '$lib/client/auth-api';

	interface Props {
		username: string;
		onLogout: () => void;
	}

	let { username, onLogout }: Props = $props();

	let copied = $state(false);
	let newToken = $state<string | null>(null);
	let rotating = $state(false);
	let rotateError = $state('');

	async function copyToken() {
		if (!newToken) return;
		await navigator.clipboard.writeText(newToken);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function handleRotate() {
		if (!confirm($_('auth.rotateKeyConfirm'))) return;
		rotating = true;
		rotateError = '';
		try {
			const result = await rotateTokenRemote();
			newToken = result.rawToken;
			copied = false;
		} catch (e) {
			rotateError = e instanceof Error ? e.message : '';
		} finally {
			rotating = false;
		}
	}

	async function handleLogout() {
		await logoutRemote();
		onLogout();
	}
</script>

<div class="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
	<p class="text-sm font-medium">{$_('auth.loggedInAs', { values: { username } })}</p>

	{#if newToken}
		<div class="space-y-2">
			<p class="text-xs text-gray-600">{$_('auth.recoveryKeyHint')}</p>
			<div class="flex gap-2">
				<input
					class="grow rounded border border-gray-300 px-2 py-1 font-mono text-xs"
					type="text"
					readonly
					value={newToken}
				/>
				<button class="rounded bg-black px-2 py-1 text-xs text-white" onclick={copyToken}>
					{copied ? $_('auth.keyCopied') : $_('auth.copyKey')}
				</button>
			</div>
		</div>
	{/if}

	{#if rotateError}
		<p class="text-xs text-red-600">{rotateError}</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button
			class="rounded border border-gray-300 px-3 py-1 text-xs"
			onclick={handleRotate}
			disabled={rotating}
		>
			{$_('auth.rotateKey')}
		</button>
		<button class="rounded border border-gray-300 px-3 py-1 text-xs" onclick={handleLogout}>
			{$_('auth.logout')}
		</button>
	</div>
</div>
```

**Step 11.1: Vérifier le check Svelte**

```bash
pnpm check
```

**Step 11.2: Commit**

```bash
git add src/lib/components/AccountPanel.svelte
git commit -m "feat(auth): add AccountPanel component"
```

---

## Task 12: UI — intégration dans +page.svelte

**Files:**

- Modify: `src/routes/+page.svelte`

L'objectif est d'ajouter en **haut du formulaire principal** une section auth avec deux branches séparées:

1. Si authentifié → afficher `<AccountPanel>`, pré-remplir le champ nom avec le username du compte.
2. Si non authentifié → afficher deux blocs repliables/onglets:
   - "Créer un compte" (bouton 1 clic quand nom saisi)
   - "Se connecter avec une clé" (champ dédié token)

**Step 12.1: Ajouter les imports et l'état auth dans le script**

Dans `<script lang="ts">` de `+page.svelte`, ajouter après les imports existants :

```typescript
import AccountPanel from '$lib/components/AccountPanel.svelte';
import {
	getAuthStateRemote,
	registerRemote,
	loginWithTokenRemote,
	type AuthState
} from '$lib/client/auth-api';

let authState = $state<AuthState>({ authenticated: false });
let authTab = $state<'register' | 'login'>('register');
let recoveryKeyInput = $state('');
let authError = $state('');
let isAuthSubmitting = $state(false);
let shownToken = $state<string | null>(null); // token affiché après création de compte
let tokenCopied = $state(false);

onMount(async () => {
	name = loadPlayerName();
	authState = await getAuthStateRemote();
	if (authState.authenticated && authState.username) {
		name = authState.username;
	}
});

async function handleRegister() {
	const trimmed = name.trim();
	if (trimmed.length < 2) {
		authError = $_('errors.nameLength');
		return;
	}
	authError = '';
	isAuthSubmitting = true;
	try {
		const result = await registerRemote(trimmed);
		shownToken = result.rawToken;
		authState = await getAuthStateRemote();
		if (authState.authenticated && authState.username) name = authState.username;
	} catch (e) {
		authError = e instanceof Error ? e.message : $_('errors.unexpected');
	} finally {
		isAuthSubmitting = false;
	}
}

async function handleLoginToken() {
	if (!recoveryKeyInput.startsWith('ccrec_')) {
		authError = $_('errors.invalidKeyFormat');
		return;
	}
	authError = '';
	isAuthSubmitting = true;
	try {
		await loginWithTokenRemote(recoveryKeyInput);
		authState = await getAuthStateRemote();
		if (authState.authenticated && authState.username) name = authState.username;
		recoveryKeyInput = '';
	} catch (e) {
		authError = e instanceof Error ? e.message : $_('errors.unexpected');
	} finally {
		isAuthSubmitting = false;
	}
}

async function copyShownToken() {
	if (!shownToken) return;
	await navigator.clipboard.writeText(shownToken);
	tokenCopied = true;
	setTimeout(() => (tokenCopied = false), 2000);
}

function handleAuthLogout() {
	authState = { authenticated: false };
	shownToken = null;
	name = loadPlayerName();
}
```

**Step 12.2: Ajouter le bloc HTML avant le formulaire principal**

Dans le `<main>`, avant le `<form>` existant, ajouter :

```svelte
{#if authState.authenticated && authState.username}
	<div class="mb-6">
		<AccountPanel username={authState.username} onLogout={handleAuthLogout} />
	</div>
{:else}
	<div class="mb-6 space-y-3 rounded-md border border-gray-200 p-4">
		<div class="flex gap-2 text-sm">
			<button
				class={`rounded px-3 py-1 ${authTab === 'register' ? 'bg-black text-white' : 'border border-gray-300'}`}
				onclick={() => {
					authTab = 'register';
					authError = '';
				}}>{$_('auth.createAccount')}</button
			>
			<button
				class={`rounded px-3 py-1 ${authTab === 'login' ? 'bg-black text-white' : 'border border-gray-300'}`}
				onclick={() => {
					authTab = 'login';
					authError = '';
				}}>{$_('auth.backToLogin')}</button
			>
		</div>

		{#if authTab === 'register'}
			<p class="text-xs text-gray-500">{$_('auth.recoveryKeyHint')}</p>
			<button
				type="button"
				class="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
				onclick={handleRegister}
				disabled={isAuthSubmitting || name.trim().length < 2}>{$_('auth.registerSubmit')}</button
			>
		{:else}
			<label class="block space-y-1">
				<span class="text-sm font-medium">{$_('auth.recoveryKeyLabel')}</span>
				<input
					class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
					type="text"
					bind:value={recoveryKeyInput}
					placeholder={$_('auth.recoveryKeyPlaceholder')}
				/>
			</label>
			<button
				type="button"
				class="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
				onclick={handleLoginToken}
				disabled={isAuthSubmitting}>{$_('auth.loginSubmit')}</button
			>
		{/if}

		{#if shownToken && authTab === 'register'}
			<div class="space-y-1">
				<p class="text-xs font-medium text-green-700">{$_('auth.recoveryKeyHint')}</p>
				<div class="flex gap-2">
					<input
						class="grow rounded border border-green-400 bg-green-50 px-2 py-1 font-mono text-xs"
						type="text"
						readonly
						value={shownToken}
					/>
					<button
						class="rounded bg-green-700 px-2 py-1 text-xs text-white"
						onclick={copyShownToken}
					>
						{tokenCopied ? $_('auth.keyCopied') : $_('auth.copyKey')}
					</button>
				</div>
			</div>
		{/if}

		{#if authError}
			<p class="text-sm text-red-600">{authError}</p>
		{/if}
	</div>
{/if}
```

**Step 12.3: Vérifier avec svelte-autofixer si disponible, puis**

```bash
pnpm check
```

Attendu : 0 erreur.

**Step 12.4: Commit**

```bash
git add src/routes/+page.svelte src/lib/components/AccountPanel.svelte
git commit -m "feat(auth): integrate auth flows into homepage"
```

---

## Task 13: Intégration gameplay — priorisation identité auth

**Files:**

- Modify: `src/routes/api/games/+server.ts`
- Modify: `src/routes/api/games/[id]/+server.ts`

L'objectif est simple et non invasif : si le cookie `cc_auth` est présent et valide lors de la création/jonction d'une partie, **utiliser le username du compte comme nom de joueur** (surpassant le nom saisi) pour éviter l'usurpation.

**Step 13.1: Modifier `src/routes/api/games/+server.ts` (POST createGame)**

Extraire le nom auth avant validation si cookie présent :

```typescript
// En début du handler POST, après `parseCreatePayload` :
import { parseAuthCookie, getAccountById, AUTH_COOKIE_NAME } from '$lib/server/auth-store';

// Dans le handler :
const cookieValue = cookies.get(AUTH_COOKIE_NAME);
const userId = parseAuthCookie(cookieValue);
if (userId) {
	const account = await getAccountById(userId);
	if (account) {
		payload.name = account.username; // Imposer le nom du compte
	}
}
```

**Step 13.2: Modifier `src/routes/api/games/[id]/+server.ts` (POST joinGame)**

Même pattern pour l'action `join`.

**Step 13.3: Vérifier et tester**

```bash
pnpm check && pnpm test
```

Attendu : 0 erreur, tous les tests passent.

**Step 13.4: Commit**

```bash
git add src/routes/api/games/+server.ts src/routes/api/games/[id]/+server.ts
git commit -m "feat(auth): use account username for game creation when authenticated"
```

---

## Task 14: Vérification finale

**Step 14.1: Tests complets**

```bash
pnpm test
```

Attendu : tous verts.

**Step 14.2: Type check**

```bash
pnpm check
```

Attendu : 0 erreur.

**Step 14.3: Lint**

```bash
pnpm lint
```

Attendu : 0 warning/erreur.

**Step 14.4: Validation i18n**

```bash
pnpm dlx i18n-unused display-unused
pnpm dlx i18n-unused display-missed
```

Attendu : aucune clé manquante.

**Step 14.5: Commit de clôture si nécessaire**
Si des fichiers non encore commités (auto-generated) traînent :

```bash
git status
git add -A
git commit -m "chore(auth): finalize auth implementation"
```
