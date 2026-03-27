# Reconnexion Explicite SSE – Plan d'Implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter une boucle de reconnexion explicite et contrôlée qui tente 10 fois de récupérer l'état serveur et de rétablir le flux SSE, avec messages clairs et bouton de refresh après échec.

**Architecture:**

- Ajouter fonction `attemptExplicitReconnect(maxAttempts)` dans `game-lifecycle.ts`
- Modifier `stream.onerror()` pour appeler cette fonction avec un message initial
- Ajouter traduction manquante `errors.reconnectionFailed` en fr/en
- TDD : tester la suite de reconnexion (succès au Nème essai, échec définitif)

**Tech Stack:** Svelte 5, TypeScript, Vitest, i18n JSON

---

## Task 1: Ajouter traductions manquantes

**Files:**

- Modify: `src/lib/i18n/fr.json` (ajouter `reconnectionFailed`)
- Modify: `src/lib/i18n/en.json` (ajouter `reconnectionFailed`)

**Step 1: Lire la section errors en français**

Run: `grep -A 50 '"errors"' src/lib/i18n/fr.json | head -40`
Expected: voir les clés d'erreur actuelles

**Step 2: Ajouter clé fr.json**

File: `src/lib/i18n/fr.json`, ligne ~148 (après `realTimeDisconnected`), ajouter:

```json
		"reconnectionFailed": "Reconnexion échouée. Veuillez rafraîchir la page.",
```

**Step 3: Ajouter clé en.json**

File: `src/lib/i18n/en.json`, même position (chercher `realTimeDisconnected`), ajouter:

```json
		"reconnectionFailed": "Reconnection failed. Please refresh the page.",
```

**Step 4: Vérifier syntaxe JSON**

Run: `pnpm check`
Expected: 0 errors, 0 warnings

**Step 5: Commit**

```bash
git add src/lib/i18n/fr.json src/lib/i18n/en.json
git commit -m "i18n: add reconnection failed message"
```

---

## Task 2: Ajouter test de reconnexion réussie au Nème essai

**Files:**

- Modify: `src/lib/state/game-lifecycle.spec.ts`
- Implement in: `src/lib/state/game-lifecycle.ts`

**Step 1: Écrire test - reconnexion réussie à la 3ème tentative**

File: `src/lib/state/game-lifecycle.spec.ts`, ajouter avant le `describe` fermant final:

```typescript
describe('explicit reconnection on SSE error', () => {
	it('attempts to reconnect with fixed 1s delay and succeeds on retry', async () => {
		const { input, lifecycle, openGameEventStream } = await createTestGameLifecycle({
			createGameView: createMockGameView()
		});
		const setErrorMessageCalls: string[] = [];
		input.setErrorMessage = (msg: string) => {
			setErrorMessageCalls.push(msg);
		};

		let attemptCount = 0;
		vi.mocked(getGameViewRemote).mockImplementation(async () => {
			attemptCount++;
			// Fail on attempts 1 & 2, succeed on attempt 3
			if (attemptCount < 3) {
				throw new Error('network error');
			}
			return createMockGameView();
		});

		// Initialize lifecycle
		await lifecycle.init();
		setErrorMessageCalls.length = 0; // Clear init call

		// Get EventSource reference
		const mockSource = openGameEventStream.mock.results[0].value;
		expect(mockSource.onerror).toBeDefined();

		// Simulate SSE error - triggers reconnection logic
		const startTime = Date.now();
		mockSource.onerror?.();

		// Should set initial error message immediately
		expect(setErrorMessageCalls[0]).toBe(translate('errors.realTimeDisconnected'));

		// Wait for reconnection attempts (2 failures + 1 success = 2s delay ~ 200ms tolerance)
		await new Promise((resolve) => setTimeout(resolve, 2500));

		// Should succeed and clear error
		expect(setErrorMessageCalls[setErrorMessageCalls.length - 1]).toBe('');
		expect(attemptCount).toBe(3); // Exactly 3 attempts
	});

	it('fails after 10 consecutive reconnection attempts and shows retry message', async () => {
		const { input, lifecycle, openGameEventStream } = await createTestGameLifecycle({
			createGameView: createMockGameView()
		});
		const setErrorMessageCalls: string[] = [];
		input.setErrorMessage = (msg: string) => {
			setErrorMessageCalls.push(msg);
		};

		// Always fail
		vi.mocked(getGameViewRemote).mockRejectedValue(new Error('network error'));

		// Initialize lifecycle
		await lifecycle.init();
		setErrorMessageCalls.length = 0;

		const mockSource = openGameEventStream.mock.results[0].value;
		mockSource.onerror?.();

		// Should set initial error immediately
		expect(setErrorMessageCalls[0]).toBe(translate('errors.realTimeDisconnected'));

		// Wait for all 10 attempts (10 × 1s = 10s, + tolerance)
		await new Promise((resolve) => setTimeout(resolve, 11000));

		// Last message should be reconnection failed
		const lastMsg = setErrorMessageCalls[setErrorMessageCalls.length - 1];
		expect(lastMsg).toBe(translate('errors.reconnectionFailed'));
	});
});
```

**Step 2: Vérifier test échoue**

Run: `pnpm test src/lib/state/game-lifecycle.spec.ts -t "explicit reconnection"`
Expected: FAIL - `attemptExplicitReconnect is not a function`

**Step 3: Implémenter `attemptExplicitReconnect()` dans game-lifecycle.ts**

File: `src/lib/state/game-lifecycle.ts`, après la fonction `refreshState()` (vers ligne 350), ajouter:

```typescript
async function attemptExplicitReconnect(maxAttempts = 10): Promise<boolean> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const game = await getGameViewRemote(input.getGameId());
			input.setGame(game);
			connectEventStream(); // Réouvre SSE
			input.setErrorMessage(''); // Efface l'erreur
			return true; // Succès
		} catch {
			if (attempt < maxAttempts) {
				// Attendre 1s avant la tentative suivante
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}
	return false; // Échec après maxAttempts
}
```

**Step 4: Modifier stream.onerror pour appeler attemptExplicitReconnect()**

File: `src/lib/state/game-lifecycle.ts`, fonction `connectEventStream()`, remplacer:

```typescript
stream.onerror = () => {
	input.setErrorMessage(translate('errors.realTimeDisconnected'));
};
```

par:

```typescript
stream.onerror = () => {
	input.setErrorMessage(translate('errors.realTimeDisconnected'));
	// Lancer reconnexion explicite sans bloquer
	void attemptExplicitReconnect().then((success) => {
		if (!success) {
			input.setErrorMessage(translate('errors.reconnectionFailed'));
		}
	});
};
```

**Step 5: Executer les tests**

Run: `pnpm test src/lib/state/game-lifecycle.spec.ts -t "explicit reconnection"`
Expected: PASS (both tests)

**Step 6: Vérifier suite complète passe**

Run: `pnpm test src/lib/state/game-lifecycle.spec.ts`
Expected: All tests pass, including new ones

**Step 7: Commit**

```bash
git add src/lib/state/game-lifecycle.ts src/lib/state/game-lifecycle.spec.ts
git commit -m "feat: implement explicit SSE reconnection with 10-attempt retry loop"
```

---

## Task 3: Vérification globale

**Files:**

- No changes, verification only

**Step 1: Type checking**

Run: `pnpm check`
Expected: 0 errors, 0 warnings

**Step 2: Full test suite**

Run: `pnpm test`
Expected: All 123 tests pass (or current count + 2 new tests)

**Step 3: Linting**

Run: `pnpm lint`
Expected: 0 errors

**Step 4: Manual test (optional)**

- Start `pnpm dev`
- Open game
- Kill network (DevTools Network tab → Offline)
- Observe: immediate message "Connexion temps réel interrompue..."
- Wait ~10 seconds
- Re-enable network manually
- Observe: error message clears on next snapshot (or shows "Reconnexion échouée" after 10s)

**Step 5: Commit if needed**

```bash
git add -A
git commit -m "test: verify explicit reconnection end-to-end"
```

---

## Execution Checklist

- [ ] Task 1: Traductions ajoutées, JSON valide
- [ ] Task 2: Tests écrits (2 cas), implémentation fonctionnelle, tous les tests passent
- [ ] Task 3: Vérification complète (`pnpm check && pnpm test && pnpm lint`)
- [ ] All commits pushed or ready to push
