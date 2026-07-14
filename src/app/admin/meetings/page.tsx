'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { openQRCodePopup } from '@/lib/qrcode-popup';

interface Meeting {
  id: number;
  title: string;
  location: string | null;
  startTime: string;
  status: 'pending' | 'active' | 'ended';
  _count: { checkIns: number };
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async (status?: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const qs = params.toString();
      const res = await fetch(`/api/admin/meetings${qs ? '?' + qs : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setMeetings(data.data.meetings);
    } catch {
      // 网络错误，保留现有数据
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setLoading(true);
    fetchMeetings(status);
  };

  const statusLabel = (s: string) =>
    s === 'pending' ? '未开始' : s === 'active' ? '进行中' : '已结束';

  const statusColor = (s: string) =>
    s === 'pending' ? 'text-yellow-600' : s === 'active' ? 'text-green-600' : 'text-gray-400';

  const handleDelete = async (m: Meeting) => {
    if (!confirm(`确定要删除会议「${m.title}」吗？\n\n此操作不可恢复，关联的所有签到记录也将被删除。`)) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/meetings/${m.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMeetings((prev) => prev.filter((item) => item.id !== m.id));
      } else {
        alert(data.error || '删除失败');
      }
    } catch {
      alert('网络错误，请重试');
    }
  };

  const handleQRCode = async (m: Meeting) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/meetings/${m.id}/qrcode`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        openQRCodePopup(m.title, data.data.qrCodeDataURL);
      }
    } catch {
      alert('获取二维码失败，请重试');
    }
  };

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">会议列表</h1>
        <Link
          href="/admin/meetings/new"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          + 创建会议
        </Link>
      </div>

      {/* 状态筛选 Tab */}
      <div className="flex gap-2 mb-6">
        {[
          { value: '', label: '全部' },
          { value: 'active', label: '进行中' },
          { value: 'pending', label: '未开始' },
          { value: 'ended', label: '已结束' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-4 py-1.5 rounded text-sm transition-colors ${
              statusFilter === tab.value
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">📭</p>
          <p>还没有会议，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold">{m.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  🕐 {new Date(m.startTime).toLocaleString('zh-CN')}
                  {m.location && ` | 📍 ${m.location}`}
                </p>
                <p className={`text-xs mt-1 ${statusColor(m.status)}`}>
                  {statusLabel(m.status)} · 已签到 {m._count.checkIns} 人
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleQRCode(m)}
                  className="text-sm border px-3 py-1 rounded hover:bg-gray-100"
                >
                  📱 二维码
                </button>
                <Link
                  href={`/admin/meetings/${m.id}/checkins`}
                  className="text-sm border px-3 py-1 rounded hover:bg-gray-100"
                >
                  📊 明细
                </Link>
                <Link
                  href={`/admin/meetings/${m.id}`}
                  className="text-sm border px-3 py-1 rounded hover:bg-gray-100"
                >
                  ✏️
                </Link>
                <button
                  onClick={() => handleDelete(m)}
                  className="text-sm border px-3 py-1 rounded text-red-500 hover:bg-red-50"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
