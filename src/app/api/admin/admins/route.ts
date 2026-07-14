import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import bcrypt from 'bcryptjs';

/** GET — 列出全部管理员 */
export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const admins = await prisma.admin.findMany({
    select: { id: true, username: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ success: true, data: { admins } });
}

/** POST — 新增管理员 */
export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // 用户名验证：仅允许字母、数字、下划线，3-50 字符
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      return NextResponse.json(
        { success: false, error: '用户名仅允许字母、数字、下划线，长度 3-50 位' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: '密码长度不能少于8位' },
        { status: 400 }
      );
    }

    const existing = await prisma.admin.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: '用户名已存在' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: { username, passwordHash },
      select: { id: true, username: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: { admin } }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: '创建管理员失败' },
      { status: 500 }
    );
  }
}
