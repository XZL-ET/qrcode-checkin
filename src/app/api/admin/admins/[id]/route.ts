import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';

/** DELETE — 删除管理员（禁止自删，会议转移给当前管理员） */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await params;
  const targetId = parseInt(idStr);
  if (isNaN(targetId) || targetId < 1) {
    return NextResponse.json({ success: false, error: '无效的管理员ID' }, { status: 400 });
  }

  // 禁止删除自己
  if (targetId === auth.adminId) {
    return NextResponse.json(
      { success: false, error: '不能删除自己的账号' },
      { status: 400 }
    );
  }

  const admin = await prisma.admin.findUnique({ where: { id: targetId } });
  if (!admin) {
    return NextResponse.json(
      { success: false, error: '管理员不存在' },
      { status: 404 }
    );
  }

  // 将该管理员创建的会议转移给当前操作的管理员
  const transferResult = await prisma.meeting.updateMany({
    where: { createdBy: targetId },
    data: { createdBy: auth.adminId },
  });

  await prisma.admin.delete({ where: { id: targetId } });

  console.log(
    `[admins] Admin "${admin.username}" (id=${targetId}) deleted by "${auth.username}" (id=${auth.adminId}). ` +
    `${transferResult.count} meeting(s) transferred.`
  );

  return NextResponse.json({
    success: true,
    data: { transferredMeetings: transferResult.count },
  });
}
