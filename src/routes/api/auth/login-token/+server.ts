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
