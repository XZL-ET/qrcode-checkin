import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { computeMeetingStatus } from '@/lib/meeting-utils';
import { proxyAvatarUrl } from '@/lib/avatar';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id) || id < 1) {
    return NextResponse.json({ success: false, error: '无效的会议ID' }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) {
    return NextResponse.json(
      { success: false, error: '会议不存在' },
      { status: 404 }
    );
  }

  // 所有权检查
  if (meeting.createdBy !== auth.adminId) {
    return NextResponse.json(
      { success: false, error: '无权访问此会议' },
      { status: 403 }
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

  // 查询全部员工，计算缺席人员和签到率
  const allEmployees = await prisma.employee.findMany({
    include: { department: true },
    orderBy: { name: 'asc' },
  });

  const checkedInEmployeeIds = new Set(records.map((r) => r.employeeId));
  const absentees = allEmployees
    .filter((e) => !checkedInEmployeeIds.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      departmentName: e.department?.name || '-',
      avatar: proxyAvatarUrl(e.avatar),
    }));

  const totalShouldAttend = allEmployees.length;
  const attendanceRate = totalShouldAttend > 0
    ? Math.round((records.length / totalShouldAttend) * 100)
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      meeting: { ...meeting, status: computeMeetingStatus(meeting.startTime, meeting.endTime) },
      records: records.map((r) => ({
        id: r.id,
        employeeName: r.employee.name,
        departmentName: r.employee.department?.name || '-',
        avatar: proxyAvatarUrl(r.employee.avatar),
        checkInTime: r.checkInTime,
      })),
      total: records.length,
      absentees,
      attendanceRate,
      totalShouldAttend,
    },
  });
}
