import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

declare global {
	var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaBetterSqlite3({
	url: process.env.DATABASE_URL ?? 'file:./dev.db'
});

export const db: PrismaClient =
	globalThis.__prisma ??
	new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
	});

if (process.env.NODE_ENV !== 'production') {
	globalThis.__prisma = db;
}
