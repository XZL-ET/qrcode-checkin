'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  totalMeetings: number;
  activeMeetings: number;
  totalCheckIns: number;
  employeeCount: number;
  avgRate: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStats(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">加载中...</p>;

  if (!stats) return <p className="text-gray-500">加载失败</p>;

  const cards = [
    { label: '会议总数', value: stats.totalMeetings, icon: '📋', color: 'text-blue-600' },
    { label: '进行中', value: stats.activeMeetings, icon: '🟢', color: 'text-green-600' },
    { label: '签到总次数', value: stats.totalCheckIns, icon: '✅', color: 'text-emerald-600' },
    { label: '员工总数', value: stats.employeeCount, icon: '👥', color: 'text-purple-600' },
    { label: '签到率(全局)', value: `${stats.avgRate}%`, icon: '📊', color: 'text-orange-600' },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">仪表盘</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg p-5 shadow-sm text-center">
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/meetings"
          className="bg-white rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">📅</span>
          <div>
            <h3 className="font-semibold">会议管理</h3>
            <p className="text-sm text-gray-500">创建、编辑、管理会议</p>
          </div>
        </Link>
        <Link
          href="/admin/settings"
          className="bg-white rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">⚙️</span>
          <div>
            <h3 className="font-semibold">系统设置</h3>
            <p className="text-sm text-gray-500">修改密码、管理管理员</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
