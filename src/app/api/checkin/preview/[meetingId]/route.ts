import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getWeWorkUserId } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  const meetingId = parseInt(params.meetingId);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json(
      { success: false, error: '缺少 OAuth code' },
      { status: 400 }
    );
  }

  try {
    const userid = await getWeWorkUserId(code);

    const employee = await prisma.employee.findUnique({
      where: { weworkUserid: userid },
      include: { department: true },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: '未找到你的信息，请联系管理员' },
        { status: 403 }
      );
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: '会议不存在' },
        { status: 404 }
      );
    }

    const existing = await prisma.checkIn.findUnique({
      where: {
        meetingId_employeeId: { meetingId, employeeId: employee.id },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          location: meeting.location,
          startTime: meeting.startTime.toISOString(),
        },
        employee: {
          id: employee.id,
          name: employee.name,
          department: employee.department?.name || null,
          avatar: employee.avatar,
        },
        alreadyCheckedIn: !!existing,
        meetingStatus: meeting.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
