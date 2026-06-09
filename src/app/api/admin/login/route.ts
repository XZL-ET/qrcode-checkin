import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAdminToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
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
