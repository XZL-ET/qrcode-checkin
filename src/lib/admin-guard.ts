import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import type { AdminPayload } from '@/types';

export async function authenticateAdmin(
  request: Request
): Promise<AdminPayload | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  try {
    return await verifyAdminToken(token);
  } catch {
    return NextResponse.json(
      { success: false, error: '登录已过期，请重新登录' },
      { status: 401 }
    );
  }
}
