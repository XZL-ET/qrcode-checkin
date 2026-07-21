import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** 给数据库连接串补上连接池上限，高并发签到时避免连接池耗尽 */
function buildDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  if (url.includes('connection_limit=')) return url;

  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=50`;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasourceUrl: buildDbUrl(),
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
