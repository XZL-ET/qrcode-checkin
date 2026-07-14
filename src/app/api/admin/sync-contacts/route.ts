import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/admin-guard';
import { syncContacts } from '@/lib/wework-api';

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await syncContacts();
    return NextResponse.json({
      success: true,
      data: result,
      message: `同步完成：${result.deptCount} 个部门，${result.empCount} 名员工`,
    });
  } catch (error) {
    console.error('[sync-contacts]', error instanceof Error ? error.message : error);
    const message = '同步失败，请稍后重试';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
