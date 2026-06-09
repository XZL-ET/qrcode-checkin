import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const [totalMeetings, activeMeetings, totalCheckIns, employeeCount] =
    await Promise.all([
      prisma.meeting.count(),
      prisma.meeting.count({ where: { status: 'active' } }),
      prisma.checkIn.count(),
      prisma.employee.count(),
    ]);

  const avgRate =
    totalMeetings > 0
      ? Math.round(
          (totalCheckIns / (totalMeetings * Math.max(employeeCount, 1))) * 100
        )
      : 0;

  return NextResponse.json({
    success: true,
    data: {
      totalMeetings,
      activeMeetings,
      totalCheckIns,
      employeeCount,
      avgRate,
    },
  });
}
