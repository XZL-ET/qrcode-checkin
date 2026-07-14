import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { generateCheckInQRCode } from '@/lib/qrcode';

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

  const { qrCodeDataURL, checkInUrl } = await generateCheckInQRCode(id);

  return NextResponse.json({
    success: true,
    data: { qrCodeDataURL, checkInUrl, meeting },
  });
}
