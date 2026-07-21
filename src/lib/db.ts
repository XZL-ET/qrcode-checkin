import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** 给数据库连接串补上连接池上限，高并发签到时避免连接池耗尽 */
function buildDbUrl(): string {
  const url = process.env.DATABASE_URL;
  // Next.js 构建阶段（collect page data）没有 DATABASE_URL，用占位串避免报错
  if (!url) return 'mysql://placeholder:placeholder@localhost:3306/placeholder?connection_limit=50';

  if (url.includes('connection_limit=')) return url;

  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=50`;
}

let _prisma: PrismaClient | undefined;

function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;

  _prisma = new PrismaClient({
    datasourceUrl: buildDbUrl(),
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = _prisma;
  }

  return _prisma;
}

// 延迟初始化：构建阶段不创建 PrismaClient，首次真正使用时才创建
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    // 方法调用需要绑定 this
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
