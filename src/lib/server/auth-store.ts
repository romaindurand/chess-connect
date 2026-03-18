import { createHash, createHmac, randomBytes } from 'node:crypto';
import { db } from './db';

const SECRET = process.env.CHESS_CONNECT_SECRET ?? 'dev-insecure-secret';
export const AUTH_COOKIE_NAME = 'cc_auth';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function generateRawToken(): string {
  return 'ccrec_' + randomBytes(32).toString('base64url');
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// ---------------------------------------------------------------------------
// Session cookie (HttpOnly cc_auth cookie)
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
// Account CRUD
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
