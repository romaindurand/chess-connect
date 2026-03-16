import { initializeBestRuntimeBackend } from '$lib/server/ai/tf-runtime';

const backend = await initializeBestRuntimeBackend();

if (backend.fallbackReason) {
	console.warn(
		`[AI][tests] Backend tensorflow indisponible. Fallback cpu/js. Détail: ${backend.fallbackReason}`
	);
}

console.info(`[AI][tests] Backend TF: ${backend.backend}`);
