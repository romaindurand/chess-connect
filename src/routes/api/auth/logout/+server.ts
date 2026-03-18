import { json } from '@sveltejs/kit';
import { AUTH_COOKIE_NAME } from '$lib/server/auth-store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
	return json({ ok: true });
};
