import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { generateCheckInQRCode } from '@/lib/qrcode';

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const status = searchParams.get('status') || undefined;

  const where = status
    ? { status: status as 'pending' | 'active' | 'ended' }
    : {};

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { checkIns: true } } },
    }),
    prisma.meeting.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: { meetings, total, page, pageSize },
  });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

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
      data: { ...meeting, qrCodeDataURL, checkInUrl },
    },
    { status: 201 }
  );
}
