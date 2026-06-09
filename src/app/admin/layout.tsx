'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">📋 签到系统</span>
          <span className="text-gray-400 text-sm">管理后台</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/meetings" className="text-sm hover:text-green-400">会议管理</Link>
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">退出</button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
