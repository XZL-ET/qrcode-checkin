import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { generateCheckInQRCode } from '@/lib/qrcode';
import { computeMeetingStatus } from '@/lib/meeting-utils';

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
  const statusFilter = searchParams.get('status')?.toLowerCase() || undefined;

  const allMeetings = await prisma.meeting.findMany({
    orderBy: { startTime: 'desc' },
    include: { _count: { select: { checkIns: true } } },
  });

  // 根据时间自动计算状态
  const enriched = allMeetings.map((m) => ({
    ...m,
    status: computeMeetingStatus(m.startTime, m.endTime),
  }));

  // 按计算后的状态过滤
  const filtered = statusFilter
    ? enriched.filter((m) => m.status === statusFilter)
    : enriched;

  const total = filtered.length;
  const meetings = filtered.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({
    success: true,
    data: { meetings, total, page, pageSize },
  });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { title, location, startTime, endTime } = await request.json();

    if (!title || !startTime) {
      return NextResponse.json(
        { success: false, error: '会议名称和开始时间不能为空' },
        { status: 400 }
      );
    }

    const meeting = await prisma.meeting.create({
      data: {
        title,
        location: location || null,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        createdBy: auth.adminId,
      },
    });

    const { qrCodeDataURL, checkInUrl } = await generateCheckInQRCode(meeting.id);

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { qrCodeUrl: checkInUrl },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...meeting,
          status: computeMeetingStatus(meeting.startTime, meeting.endTime),
          qrCodeDataURL,
          checkInUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[meetings] POST error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: '创建会议失败，请检查数据是否完整' },
      { status: 500 }
    );
  }
}
