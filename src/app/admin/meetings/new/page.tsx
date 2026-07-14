'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { openQRCodePopup } from '@/lib/qrcode-popup';

/** 将 datetime-local 输入框的值转为带时区的 ISO 字符串，确保服务器能正确解析 */
function toISOString(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  const d = new Date(datetimeLocal + ':00');
  return d.toISOString();
}

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

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          startTime: toISOString(form.startTime),
          endTime: form.endTime ? toISOString(form.endTime) : '',
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      const qrDataURL = data.data.qrCodeDataURL;
      openQRCodePopup(form.title, qrDataURL);
      router.push('/admin/meetings');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
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
          <label className="block text-sm text-gray-600 mb-1">会议详细</label>
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
