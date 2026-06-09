import { NextResponse } from 'next/server';
import { syncContacts } from '@/lib/wework-api';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.INTERNAL_API_TOKEN || 'internal-secret';

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await syncContacts();
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '同步失败';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
