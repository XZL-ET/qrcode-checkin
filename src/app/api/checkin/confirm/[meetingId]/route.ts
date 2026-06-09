import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  const meetingId = parseInt(params.meetingId);
  const { employeeId } = await request.json();

  if (!employeeId) {
    return NextResponse.json(
      { success: false, error: '缺少员工信息' },
      { status: 400 }
    );
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) {
    return NextResponse.json(
      { success: false, error: '会议不存在' },
      { status: 404 }
    );
  }

  if (meeting.status === 'ended') {
    return NextResponse.json(
      { success: false, error: '会议已结束，无法签到' },
      { status: 400 }
    );
  }

  const existing = await prisma.checkIn.findUnique({
    where: { meetingId_employeeId: { meetingId, employeeId } },
  });

  if (existing) {
    return NextResponse.json(
      { success: false, error: '你已签到，无需重复签到' },
      { status: 400 }
    );
  }

  const checkIn = await prisma.checkIn.create({
    data: { meetingId, employeeId },
  });

  return NextResponse.json({
    success: true,
    data: { id: checkIn.id, checkInTime: checkIn.checkInTime },
  });
}
