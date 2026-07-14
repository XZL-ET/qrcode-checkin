export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { syncContacts } = await import('./lib/wework-api');

    const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 小时

    // 启动后 30 秒执行首次同步（等待数据库连接就绪）
    setTimeout(async () => {
      try {
        console.log('[scheduler] 开始首次自动同步通讯录...');
        const result = await syncContacts();
        console.log(`[scheduler] 首次同步完成: ${result.deptCount} 个部门, ${result.empCount} 名员工`);
      } catch (error) {
        console.error('[scheduler] 首次同步失败:', error instanceof Error ? error.message : error);
      }
    }, 30000);

    // 定时同步
    const interval = setInterval(async () => {
      try {
        console.log('[scheduler] 开始定时同步通讯录...');
        const result = await syncContacts();
        console.log(`[scheduler] 定时同步完成: ${result.deptCount} 个部门, ${result.empCount} 名员工`);
      } catch (error) {
        console.error('[scheduler] 定时同步失败:', error instanceof Error ? error.message : error);
      }
    }, SYNC_INTERVAL_MS);

    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => clearInterval(interval));
    }
  }
}
