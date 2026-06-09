'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewMeetingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    location: '',
    startTime: '',
    endTime: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/meetings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!data.success) {
      setError(data.error);
      setLoading(false);
      return;
    }

    const w = window.open('', '_blank', 'width=420,height=620')!;
    w.document.write(
      `<html><body style="margin:0;text-align:center;padding:20px;font-family:sans-serif"><h2>${form.title}</h2><img src="${data.data.qrCodeDataURL}" style="max-width:100%" alt="签到二维码"/><p style="color:#888;margin-top:12px">扫码即可签到</p><button onclick="window.close()" style="margin-top:16px;padding:8px 32px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer">关闭</button></body></html>`
    );
    router.push('/admin/meetings');
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">创建会议</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">会议名称 *</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">会议地点</label>
          <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">开始时间 *</label>
          <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">结束时间</label>
          <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50">
            {loading ? '创建中...' : '创建并生成二维码'}
          </button>
        </div>
      </form>
    </div>
  );
}
