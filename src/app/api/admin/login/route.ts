import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAdminToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// 简单内存限速：每个 IP 最多 5 次/分钟
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

// 用于防时序攻击的虚拟哈希
const DUMMY_HASH = '$2a$10$dummy.hash.for.timing.attack.protection';

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // 限速检查
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: '登录尝试过于频繁，请稍后再试' },
        { status: 429 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { username } });

    // 防时序攻击：无论用户是否存在都执行 bcrypt 对比
    const hashToCheck = admin ? admin.passwordHash : DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!admin || !valid) {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const token = await signAdminToken({
      adminId: admin.id,
      username: admin.username,
    });

    return NextResponse.json({
      success: true,
      data: { token, username: admin.username },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
