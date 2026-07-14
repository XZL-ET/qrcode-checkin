import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { computeMeetingStatus } from '@/lib/meeting-utils';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id) || id < 1) {
      return NextResponse.json({ success: false, error: '无效的会议ID' }, { status: 400 });
    }

    const { title, location, startTime, endTime } = await request.json();

    // 验证日期
    if (startTime) {
      const startDate = new Date(startTime);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ success: false, error: '无效的开始时间' }, { status: 400 });
      }
      if (endTime) {
        const endDate = new Date(endTime);
        if (isNaN(endDate.getTime())) {
          return NextResponse.json({ success: false, error: '无效的结束时间' }, { status: 400 });
        }
        if (endDate <= startDate) {
          return NextResponse.json({ success: false, error: '结束时间必须晚于开始时间' }, { status: 400 });
        }
      }
    }

    // 所有权检查
    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: '会议不存在' }, { status: 404 });
    }
    if (existing.createdBy !== auth.adminId) {
      return NextResponse.json({ success: false, error: '无权修改此会议' }, { status: 403 });
    }

    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(location !== undefined && { location }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && {
          endTime: endTime ? new Date(endTime) : null,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: { ...meeting, status: computeMeetingStatus(meeting.startTime, meeting.endTime) },
    });
  } catch (error) {
    console.error('[meetings] PUT error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: '更新会议失败，请检查数据是否完整' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id) || id < 1) {
    return NextResponse.json({ success: false, error: '无效的会议ID' }, { status: 400 });
  }

  try {
    // 所有权检查
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      return NextResponse.json({ success: false, error: '会议不存在' }, { status: 404 });
    }
    if (meeting.createdBy !== auth.adminId) {
      return NextResponse.json({ success: false, error: '无权删除此会议' }, { status: 403 });
    }

    // 先删除关联的签到记录，再删除会议
    await prisma.checkIn.deleteMany({ where: { meetingId: id } });
    await prisma.meeting.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[meetings] DELETE error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: '删除会议失败' },
      { status: 500 }
    );
  }
}
