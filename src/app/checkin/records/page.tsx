'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Record {
  id: number;
  meetingTitle: string;
  meetingLocation: string | null;
  checkInTime: string;
}

function RecordsContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const nonWxwork = searchParams.get('non_wxwork') === '1';

  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (nonWxwork || !code) {
      setLoading(false);
      return;
    }

    fetch(`/api/checkin/my-records?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRecords(data.data);
        } else {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('网络错误');
        setLoading(false);
      });
  }, [code, nonWxwork]);

  // 非企微访问提示
  if (nonWxwork) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-6">📱</div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">请使用企业微信扫码</h1>
        <p className="text-gray-700 text-lg mb-6">当前页面仅支持在<strong className="text-gray-900">企业微信</strong>中打开</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 text-lg">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-gray-800 text-base">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">📋</div>
          <h1 className="text-2xl font-extrabold text-gray-900">我的签到记录</h1>
          <p className="text-base text-gray-600 mt-2">最近 {records.length} 次签到</p>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">📭</p>
            <p>暂无签到记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900">{r.meetingTitle}</h3>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500">
                    🕐 {new Date(r.checkInTime).toLocaleString('zh-CN')}
                  </p>
                  {r.meetingLocation && (
                    <p className="text-sm text-gray-400">📍 {r.meetingLocation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 text-lg">加载中...</p>
      </div>
    }>
      <RecordsContent />
    </Suspense>
  );
}
