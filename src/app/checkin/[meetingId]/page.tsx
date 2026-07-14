'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface PreviewData {
  meeting: { id: number; title: string; location: string | null; startTime: string };
  employee: { id: number; name: string; department: string | null; avatar: string | null };
  alreadyCheckedIn: boolean;
  meetingStatus: string;
  confirmToken: string;
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
        body: JSON.stringify({ employeeId: preview.employee.id, token: preview.confirmToken }),
      });
      const data = await res.json();

      if (data.success) {
        setCheckedIn(true);
        // 签到成功后 1.5 秒自动关闭窗口
        setTimeout(() => {
          if (typeof window !== 'undefined' && (window as unknown as { WeixinJSBridge?: { call: (method: string) => void } }).WeixinJSBridge) {
            (window as unknown as { WeixinJSBridge: { call: (method: string) => void } }).WeixinJSBridge.call('closeWindow');
          } else {
            window.close();
          }
        }, 1500);
      } else {
        setError(data.error);
      }
    } catch {
      setError('签到失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 非企微访问提示
  if (nonWxwork) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-6">📱</div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">请使用企业微信扫码</h1>
        <p className="text-gray-700 text-lg mb-6">当前页面仅支持在<strong className="text-gray-900">企业微信</strong>中打开</p>
        <div className="bg-white rounded-xl p-6 text-left text-base text-gray-800 max-w-sm shadow space-y-2">
          <p>✅ 打开<strong className="text-gray-900">企业微信</strong>，用扫一扫扫描签到二维码</p>
          <p>❌ 微信、浏览器扫码均无法进入</p>
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
          <p className="text-gray-800 text-base">{error}</p>
        </div>
      </div>
    );
  }

  // 加载中
  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 text-lg">加载中...</p>
      </div>
    );
  }

  const isEnded = preview.meetingStatus === 'ended';
  const isPending = preview.meetingStatus === 'pending';

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{checkedIn ? '✅' : '📋'}</div>
          <h1 className="text-2xl font-extrabold text-gray-900">{checkedIn ? '签到成功' : '签到确认'}</h1>
          <p className="text-base text-gray-600 mt-2">
            {checkedIn ? '你已完成签到，窗口即将关闭' : '会议信息已确认，身份已匹配'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
          <h2 className="font-bold text-gray-900 text-lg">📋 {preview.meeting.title}</h2>
          <p className="text-base text-gray-700 mt-2">
            🕐 {new Date(preview.meeting.startTime).toLocaleString('zh-CN')}
          </p>
          {preview.meeting.location && (
            <p className="text-base text-gray-700 mt-1">📍 {preview.meeting.location}</p>
          )}
        </div>

        <div className="bg-green-50 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center text-xl font-bold">
              {preview.employee.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{preview.employee.name}</p>
              <p className="text-base text-gray-600">{preview.employee.department || '-'}</p>
            </div>
          </div>
        </div>

        {error && <p className="text-red-600 text-base text-center mb-3 font-semibold">{error}</p>}

        {checkedIn ? (
          <button disabled className="w-full py-4 rounded-lg text-lg font-bold bg-gray-300 text-gray-600">
            已签到 ✅
          </button>
        ) : isPending ? (
          <button disabled className="w-full py-4 rounded-lg text-lg font-bold bg-gray-300 text-gray-600">
            会议未开始
          </button>
        ) : isEnded ? (
          <button disabled className="w-full py-4 rounded-lg text-lg font-bold bg-gray-300 text-gray-600">
            会议已结束
          </button>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full py-4 rounded-lg text-xl font-bold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '签到中...' : '签到'}
          </button>
        )}

        <p className="text-sm text-gray-500 text-center mt-4">扫码自动匹配身份，无需手动输入</p>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 text-lg">加载中...</p>
      </div>
    }>
      <CheckInContent />
    </Suspense>
  );
}
