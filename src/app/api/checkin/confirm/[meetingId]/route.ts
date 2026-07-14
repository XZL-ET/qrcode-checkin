import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeMeetingStatus } from '@/lib/meeting-utils';
import { verifyCheckInToken } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId: meetingIdStr } = await params;
  const meetingId = parseInt(meetingIdStr);
  if (isNaN(meetingId) || meetingId < 1) {
    return NextResponse.json({ success: false, error: '无效的会议ID' }, { status: 400 });
  }
  const { employeeId, token } = await request.json();

  // 验证确认 token（由 preview 接口 OAuth 验证后签发），防止伪造签到
  if (!token) {
    return NextResponse.json(
      { success: false, error: '缺少验证令牌，请重新扫码' },
      { status: 400 }
    );
  }

  let tokenPayload: { meetingId: number; employeeId: number };
  try {
    tokenPayload = await verifyCheckInToken(token);
  } catch {
    return NextResponse.json(
      { success: false, error: '验证令牌无效或已过期，请重新扫码' },
      { status: 403 }
    );
  }

  // token 中的 meetingId/employeeId 必须与请求一致
  if (tokenPayload.meetingId !== meetingId || tokenPayload.employeeId !== employeeId) {
    return NextResponse.json(
      { success: false, error: '验证令牌与请求不匹配' },
      { status: 403 }
    );
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) {
    return NextResponse.json(
      { success: false, error: '会议不存在' },
      { status: 404 }
    );
  }

  const meetingStatus = computeMeetingStatus(meeting.startTime, meeting.endTime);

  if (meetingStatus === 'pending') {
    return NextResponse.json(
      { success: false, error: '会议尚未开始，请稍后再签到' },
      { status: 400 }
    );
  }

  if (meetingStatus === 'ended') {
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

  try {
    const checkIn = await prisma.checkIn.create({
      data: { meetingId, employeeId },
    });

    return NextResponse.json({
      success: true,
      data: { id: checkIn.id, checkInTime: checkIn.checkInTime },
    });
  } catch (error) {
    // 捕获唯一约束冲突（并发重复签到），返回友好消息
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { success: false, error: '你已签到，无需重复签到' },
        { status: 400 }
      );
    }
    throw error;
  }
}
