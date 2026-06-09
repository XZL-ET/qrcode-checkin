import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);
  const { title, location, startTime, endTime, status } = await request.json();

  const meeting = await prisma.meeting.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(location !== undefined && { location }),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime !== undefined && {
        endTime: endTime ? new Date(endTime) : null,
      }),
      ...(status && { status }),
    },
  });

  return NextResponse.json({ success: true, data: meeting });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);
  await prisma.meeting.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
