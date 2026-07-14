'use client';

import { useState, useEffect } from 'react';

interface Admin {
  id: number;
  username: string;
  createdAt: string;
}

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // 管理员管理
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    setUsername(localStorage.getItem('admin_username') || '');
    fetchAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAdmins = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setAdmins(data.data.admins);
    } catch {
      // 静默失败，不影响其他功能
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 8) {
      setError('新密码长度不能少于8位');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/settings/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      setSuccess('密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-6">个人设置</h1>

      {/* 基本信息 */}
      <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4 text-gray-700">基本信息</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-500 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              disabled
              className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* 修改密码 */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="font-semibold mb-4 text-gray-700">修改密码</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">当前密码</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="至少8位"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '修改中...' : '修改密码'}
          </button>
        </form>
      </div>

      {/* 管理员管理 */}
      <div className="bg-white rounded-lg p-6 shadow-sm mt-6">
        <h2 className="font-semibold mb-4 text-gray-700">管理员管理</h2>

        {/* 管理员列表 */}
        <div className="space-y-2 mb-6">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <span className="text-sm font-medium">{admin.username}</span>
                <span className="text-xs text-gray-400 ml-2">
                  创建于 {new Date(admin.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              {admin.username !== username && (
                <button
                  onClick={async () => {
                    if (!confirm(`确定删除管理员「${admin.username}」吗？`)) return;
                    try {
                      const token = localStorage.getItem('admin_token');
                      const res = await fetch(`/api/admin/admins/${admin.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const data = await res.json();
                      if (data.success) {
                        setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
                      } else {
                        setAdminError(data.error);
                      }
                    } catch {
                      setAdminError('网络错误，请重试');
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 新增管理员 */}
        <div className="border-t pt-4">
          <h3 className="text-sm text-gray-600 mb-3">新增管理员</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newAdminUser}
              onChange={(e) => setNewAdminUser(e.target.value)}
              placeholder="用户名"
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="password"
              value={newAdminPass}
              onChange={(e) => setNewAdminPass(e.target.value)}
              placeholder="密码（至少8位）"
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {adminError && <p className="text-red-500 text-sm mb-2">{adminError}</p>}
          {adminSuccess && <p className="text-green-500 text-sm mb-2">{adminSuccess}</p>}
          <button
            onClick={async () => {
              setAdminError('');
              setAdminSuccess('');

              if (!newAdminUser || !newAdminPass) {
                setAdminError('用户名和密码不能为空');
                return;
              }
              if (newAdminPass.length < 8) {
                setAdminError('密码长度不能少于8位');
                return;
              }

              const token = localStorage.getItem('admin_token');
              const res = await fetch('/api/admin/admins', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ username: newAdminUser, password: newAdminPass }),
              });
              const data = await res.json();

              if (data.success) {
                setAdmins((prev) => [...prev, data.data.admin]);
                setNewAdminUser('');
                setNewAdminPass('');
                setAdminSuccess('管理员添加成功');
              } else {
                setAdminError(data.error);
              }
            }}
            className="w-full bg-gray-800 text-white py-2 rounded text-sm hover:bg-gray-900 transition-colors"
          >
            添加管理员
          </button>
        </div>
      </div>
    </div>
  );
}
