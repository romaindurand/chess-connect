import { json } from '@sveltejs/kit';

import { listLadder } from '$lib/server/ranking-store';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const rawLimit = Number(url.searchParams.get('limit') ?? '200');
	const safeLimit = Number.isFinite(rawLimit)
		? Math.max(1, Math.min(500, Math.trunc(rawLimit)))
		: 200;

	const ladder = await listLadder(safeLimit);
	return json({ ladder });
};
