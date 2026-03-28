import { error } from '@sveltejs/kit';

import { requireAuthenticatedAccount } from '$lib/server/ranked-auth';
import { heartbeatRapidQueue } from '$lib/server/rapid-matchmaking';
import { DEFAULT_MATCHMAKING_CONFIG } from '$lib/server/ranked-matchmaking-config';
import type { RequestHandler } from './$types';

function encodeSse(payload: unknown): string {
	return `data: ${JSON.stringify(payload)}\n\n`;
}

export const GET: RequestHandler = async ({ cookies }) => {
	let account;
	try {
		account = await requireAuthenticatedAccount(cookies);
	} catch {
		throw error(401, 'errors.notAuthenticated');
	}

	let timer: NodeJS.Timeout | null = null;
	let keepAlive: NodeJS.Timeout | null = null;
	let stopped = false;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const encoder = new TextEncoder();

			const push = async () => {
				if (stopped) {
					return;
				}
				try {
					const status = await heartbeatRapidQueue(account.id);
					controller.enqueue(encoder.encode(encodeSse({ type: 'queue', status })));
				} catch {
					stopped = true;
					controller.close();
				}
			};

			void push();
			timer = setInterval(() => {
				void push();
			}, DEFAULT_MATCHMAKING_CONFIG.pollingIntervalMs);

			keepAlive = setInterval(() => {
				if (!stopped) {
					controller.enqueue(encoder.encode(encodeSse({ type: 'keepalive', at: Date.now() })));
				}
			}, 15_000);
		},
		cancel() {
			stopped = true;
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
			if (keepAlive) {
				clearInterval(keepAlive);
				keepAlive = null;
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
};
