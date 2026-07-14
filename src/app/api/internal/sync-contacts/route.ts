import { NextResponse } from 'next/server';
import { syncContacts } from '@/lib/wework-api';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.INTERNAL_API_TOKEN;

  if (!expectedToken) {
    return NextResponse.json(
      { success: false, error: 'Internal API token not configured' },
      { status: 500 }
    );
  }

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
    console.error('[internal-sync]', error instanceof Error ? error.message : error);
    const message = '同步失败，请稍后重试';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
