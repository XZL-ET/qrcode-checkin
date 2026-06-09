import QRCode from 'qrcode';

export async function generateCheckInQRCode(
  meetingId: number
): Promise<{ qrCodeDataURL: string; checkInUrl: string }> {
  // 使用服务端环境变量（非 NEXT_PUBLIC_，避免构建时写死）
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const checkInUrl = `${baseUrl}/checkin/${meetingId}`;

  const dataURL = await QRCode.toDataURL(checkInUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  return { qrCodeDataURL: dataURL, checkInUrl };
}
