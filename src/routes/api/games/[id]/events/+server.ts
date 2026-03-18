import { error } from '@sveltejs/kit';

import { cookieName, getViewForRequest, subscribeToGame } from '$lib/server/game-store';
import type { ServerEvent } from '$lib/types/game';
import type { RequestHandler } from './$types';

function encodeSse(event: ServerEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

export const GET: RequestHandler = ({ params, cookies }) => {
	const gameId = params.id;
	const token = cookies.get(cookieName(gameId));

	let teardown: (() => void) | null = null;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const encoder = new TextEncoder();
			try {
				const view = getViewForRequest(gameId, token);
				controller.enqueue(encoder.encode(encodeSse({ type: 'snapshot', game: view })));
			} catch {
				controller.error(error(404, 'common.gameNotFound'));
				return;
			}

			teardown = subscribeToGame(gameId, (event) => {
				if (event.type === 'snapshot') {
					const view = getViewForRequest(gameId, token);
					controller.enqueue(encoder.encode(encodeSse({ type: 'snapshot', game: view })));
					return;
				}
				controller.enqueue(encoder.encode(encodeSse(event)));
			});
		},
		cancel() {
			if (teardown) {
				teardown();
				teardown = null;
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
