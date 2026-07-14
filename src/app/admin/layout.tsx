'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncModal, setSyncModal] = useState<{
    success: boolean;
    title: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const stored = localStorage.getItem('admin_username');
    if (!token && pathname !== '/admin/login') {
      router.push('/admin/login');
    } else if (stored) {
      setUsername(stored);
    }
  }, [pathname, router]);

  if (pathname === '/admin/login') return <>{children}</>;

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    router.push('/admin/login');
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncModal(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/sync-contacts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setSyncModal({
          success: true,
          title: '✅ 同步完成',
          detail: data.message || `同步了 ${data.data?.deptCount ?? '?'} 个部门，${data.data?.empCount ?? '?'} 名员工`,
        });
      } else {
        setSyncModal({
          success: false,
          title: '❌ 同步失败',
          detail: data.error || '未知错误',
        });
      }
    } catch {
      setSyncModal({
        success: false,
        title: '❌ 网络错误',
        detail: '无法连接到服务器，请检查网络后重试',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">📋 签到系统</span>
          <span className="text-gray-400 text-sm">管理后台</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm hover:text-green-400">仪表盘</Link>
          <Link href="/admin/meetings" className="text-sm hover:text-green-400">会议管理</Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-sm text-gray-400 hover:text-green-400 disabled:opacity-50"
            title="从企业微信同步最新通讯录"
          >
            {syncing ? '⏳ 同步中...' : '🔄 同步通讯录'}
          </button>
          <Link href="/admin/settings" className="text-sm hover:text-green-400">个人设置</Link>
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">退出</button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">{children}</main>

      {/* 同步结果弹窗 */}
      {syncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in">
            {/* 头部 */}
            <div className={`px-6 py-5 ${syncModal.success ? 'bg-green-500' : 'bg-red-500'}`}>
              <h2 className="text-xl font-bold text-white">{syncModal.title}</h2>
            </div>

            {/* 内容 */}
            <div className="px-6 py-6">
              <p className="text-gray-700 text-base leading-relaxed">{syncModal.detail}</p>
            </div>

            {/* 底部按钮 */}
            <div className="px-6 pb-5 flex justify-end">
              <button
                onClick={() => setSyncModal(null)}
                className={`px-6 py-2.5 rounded-lg text-white font-medium transition-colors ${
                  syncModal.success
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
