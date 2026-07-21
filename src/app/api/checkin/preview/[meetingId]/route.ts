import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getWeWorkUserId, signCheckInToken } from '@/lib/auth';
import { computeMeetingStatus } from '@/lib/meeting-utils';
import { proxyAvatarUrl } from '@/lib/avatar';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId: meetingIdStr } = await params;
  const meetingId = parseInt(meetingIdStr);
  if (isNaN(meetingId) || meetingId < 1) {
    return NextResponse.json({ success: false, error: '无效的会议ID' }, { status: 400 });
  }
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

    if (!userid) {
      return NextResponse.json(
        { success: false, error: 'OAuth 授权失败，企微未返回用户标识，请重试扫码' },
        { status: 403 }
      );
    }

    // 并行查询 employee 和 meeting（互不依赖），减少 DB 连接占用时间
    const [employee, meeting] = await Promise.all([
      prisma.employee.findUnique({
        where: { weworkUserid: userid },
        include: { department: true },
      }),
      prisma.meeting.findUnique({
        where: { id: meetingId },
      }),
    ]);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: '未找到你的信息，请联系管理员同步通讯录' },
        { status: 403 }
      );
    }

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

    // 签发一次性确认 token，防止确认接口被伪造请求绕过 OAuth
    const confirmToken = await signCheckInToken({
      meetingId,
      employeeId: employee.id,
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
          avatar: proxyAvatarUrl(employee.avatar),
        },
        alreadyCheckedIn: !!existing,
        meetingStatus: computeMeetingStatus(meeting.startTime, meeting.endTime),
        confirmToken,
      },
    });
  } catch (error) {
    console.error('[checkin] preview error:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : '';

    // 企微 OAuth 失败（非企业成员扫码等）
    if (message.includes('Failed to get') || message.includes('errcode')) {
      return NextResponse.json(
        { success: false, error: '企业微信授权失败，请确认你已加入该企业' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: '服务器错误，请重试' },
      { status: 500 }
    );
  }
}
