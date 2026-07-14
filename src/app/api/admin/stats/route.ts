import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { computeMeetingStatus } from '@/lib/meeting-utils';

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const [totalMeetings, allMeetings, totalCheckIns, employeeCount] =
    await Promise.all([
      prisma.meeting.count(),
      prisma.meeting.findMany({ select: { startTime: true, endTime: true } }),
      prisma.checkIn.count(),
      prisma.employee.count(),
    ]);

  const activeMeetings = allMeetings.filter(
    (m) => computeMeetingStatus(m.startTime, m.endTime) === 'active'
  ).length;

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
