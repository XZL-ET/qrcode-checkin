import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import bcrypt from 'bcryptjs';

export async function PUT(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '当前密码和新密码不能为空' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: '新密码长度不能少于8位' },
        { status: 400 }
      );
    }

    // 验证当前密码
    const admin = await prisma.admin.findUnique({
      where: { id: auth.adminId },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: '管理员不存在' },
        { status: 404 }
      );
    }

    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: '当前密码错误' },
        { status: 401 }
      );
    }

    // 更新密码
    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({
      where: { id: auth.adminId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
