'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface PreviewData {
  meeting: { id: number; title: string; location: string | null; startTime: string };
  employee: { id: number; name: string; department: string | null; avatar: string | null };
  alreadyCheckedIn: boolean;
  meetingStatus: string;
}

function CheckInContent() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const nonWxwork = searchParams.get('non_wxwork') === '1';

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    if (nonWxwork || !code) return;

    fetch(`/api/checkin/preview/${meetingId}?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPreview(data.data);
          if (data.data.alreadyCheckedIn) setCheckedIn(true);
        } else {
          setError(data.error);
        }
      })
      .catch(() => setError('网络错误'));
  }, [meetingId, code, nonWxwork]);

  const handleCheckIn = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/checkin/confirm/${meetingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: preview.employee.id }),
      });
      const data = await res.json();

      if (data.success) {
        setCheckedIn(true);
      } else {
        setError(data.error);
      }
    } catch {
      setError('签到失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 下载引导页
  if (nonWxwork) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">📱</div>
        <h1 className="text-xl font-bold mb-2">请使用企业微信扫码</h1>
        <p className="text-gray-500 mb-8">检测到你还没有安装企业微信，请先下载</p>
        <a
          href="https://work.weixin.qq.com/"
          className="bg-green-500 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-600 mb-4 w-full max-w-xs inline-block"
        >
          📥 下载企业微信
        </a>
        <p className="text-sm text-gray-400 mb-6">安装后重新扫码即可签到</p>
        <div className="bg-white rounded-lg p-4 text-left text-sm text-gray-500 max-w-xs">
          <p className="font-semibold text-gray-600 mb-2">💡 已经有企业微信？</p>
          <p>· 请用<strong>企业微信的扫一扫</strong>重新扫码</p>
          <p>· 或在企微中<strong>打开工作台</strong>找到签到应用</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // 加载中
  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  const isEnded = preview.meetingStatus === 'ended';

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{checkedIn ? '✅' : '📋'}</div>
          <h1 className="text-xl font-bold">{checkedIn ? '签到成功' : '签到确认'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {checkedIn ? '你已完成签到' : '会议信息已确认，身份已匹配'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <h2 className="font-semibold">📋 {preview.meeting.title}</h2>
          <p className="text-sm text-gray-500 mt-2">
            🕐 {new Date(preview.meeting.startTime).toLocaleString('zh-CN')}
          </p>
          {preview.meeting.location && (
            <p className="text-sm text-gray-500 mt-1">📍 {preview.meeting.location}</p>
          )}
        </div>

        <div className="bg-green-50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center text-lg font-bold">
              {preview.employee.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold">{preview.employee.name}</p>
              <p className="text-sm text-gray-500">{preview.employee.department || '-'}</p>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

        {checkedIn ? (
          <button disabled className="w-full py-3 rounded-lg text-lg font-semibold bg-gray-200 text-gray-500">
            已签到 ✅
          </button>
        ) : isEnded ? (
          <button disabled className="w-full py-3 rounded-lg text-lg font-semibold bg-gray-200 text-gray-500">
            会议已结束
          </button>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full py-3 rounded-lg text-lg font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '签到中...' : '签到'}
          </button>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">扫码自动匹配身份，无需手动输入</p>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    }>
      <CheckInContent />
    </Suspense>
  );
}
