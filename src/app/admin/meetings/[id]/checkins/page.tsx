'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface CheckInRecord {
  id: number;
  employeeName: string;
  departmentName: string;
  avatar: string | null;
  checkInTime: string;
}

export default function CheckInsPage() {
  const { id } = useParams<{ id: string }>();
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [meeting, setMeeting] = useState<{ title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch(`/api/admin/meetings/${id}/checkins`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRecords(data.data.records);
          setMeeting(data.data.meeting);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">{meeting?.title || '签到明细'}</h1>
      <p className="text-sm text-gray-500 mb-6">共 {records.length} 人签到</p>

      {records.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">📭</p>
          <p>暂无签到记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-500">
                <th className="px-4 py-3">员工</th>
                <th className="px-4 py-3">部门</th>
                <th className="px-4 py-3">签到时间</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">
                      {r.employeeName.charAt(0)}
                    </div>
                    <span>{r.employeeName}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.departmentName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(r.checkInTime).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
