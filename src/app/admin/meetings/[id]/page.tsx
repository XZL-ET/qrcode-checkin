'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function EditMeetingPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState({ title: '', location: '', startTime: '', endTime: '', status: 'pending' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch(`/api/admin/meetings?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const m = data.data.meetings.find((m: { id: number }) => m.id === parseInt(id));
          if (m) {
            setForm({
              title: m.title,
              location: m.location || '',
              startTime: new Date(m.startTime).toISOString().slice(0, 16),
              endTime: m.endTime ? new Date(m.endTime).toISOString().slice(0, 16) : '',
              status: m.status,
            });
          }
        }
        setFetching(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('admin_token');
    const res = await fetch(`/api/admin/meetings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!data.success) { setError(data.error); setLoading(false); return; }
    router.push('/admin/meetings');
  };

  if (fetching) return <p className="text-gray-500">加载中...</p>;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">编辑会议</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">会议名称</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">地点</label>
          <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">开始时间</label>
          <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">结束时间</label>
          <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">状态</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="pending">未开始</option>
            <option value="active">进行中</option>
            <option value="ended">已结束</option>
          </select>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50">{loading ? '保存中...' : '保存'}</button>
        </div>
      </form>
    </div>
  );
}
