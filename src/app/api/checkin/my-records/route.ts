import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getWeWorkUserId } from '@/lib/auth';

export async function GET(request: Request) {
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
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: '未找到员工信息' },
        { status: 403 }
      );
    }

    const records = await prisma.checkIn.findMany({
      where: { employeeId: employee.id },
      include: { meeting: true },
      orderBy: { checkInTime: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: records.map((r) => ({
        id: r.id,
        meetingTitle: r.meeting.title,
        meetingLocation: r.meeting.location,
        checkInTime: r.checkInTime,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
