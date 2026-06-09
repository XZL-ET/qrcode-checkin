import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAdmin } from '@/lib/admin-guard';
import { generateCheckInQRCode } from '@/lib/qrcode';

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

  const { qrCodeDataURL, checkInUrl } = await generateCheckInQRCode(id);

  return NextResponse.json({
    success: true,
    data: { qrCodeDataURL, checkInUrl, meeting },
  });
}
