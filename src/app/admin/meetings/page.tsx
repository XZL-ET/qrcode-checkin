'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/meetings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setMeetings(data.data.meetings);
    setLoading(false);
  };

  const statusLabel = (s: string) =>
    s === 'pending' ? '未开始' : s === 'active' ? '进行中' : '已结束';

  const statusColor = (s: string) =>
    s === 'pending' ? 'text-yellow-600' : s === 'active' ? 'text-green-600' : 'text-gray-400';

  const handleQRCode = async (m: Meeting) => {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`/api/admin/meetings/${m.id}/qrcode`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      const w = window.open('', '_blank', 'width=420,height=620')!;
      w.document.write(
        `<html><body style="margin:0;text-align:center;padding:20px;font-family:sans-serif"><h2 style="margin-bottom:12px">${m.title}</h2><img src="${data.data.qrCodeDataURL}" style="max-width:100%" alt="签到二维码"/><p style="color:#888;margin-top:12px">扫码即可签到</p><button onclick="window.close()" style="margin-top:16px;padding:8px 32px;font-size:14px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer">关闭</button></body></html>`
      );
    }
  };

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">会议列表</h1>
        <Link
          href="/admin/meetings/new"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          + 创建会议
        </Link>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
