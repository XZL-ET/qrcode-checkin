import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) {
    return NextResponse.json(
      { success: false, error: '会议不存在' },
      { status: 404 }
    );
  }

  const records = await prisma.checkIn.findMany({
    where: { meetingId: id },
    include: {
      employee: {
        include: { department: true },
      },
    },
    orderBy: { checkInTime: 'asc' },
  });

  return NextResponse.json({
    success: true,
    data: {
      meeting,
      records: records.map((r) => ({
        id: r.id,
        employeeName: r.employee.name,
        departmentName: r.employee.department?.name || '-',
        avatar: r.employee.avatar,
        checkInTime: r.checkInTime,
      })),
      total: records.length,
    },
  });
}
