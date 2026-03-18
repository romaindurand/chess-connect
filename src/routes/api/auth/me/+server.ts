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
