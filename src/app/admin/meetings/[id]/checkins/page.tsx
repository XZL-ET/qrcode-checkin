'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import * as XLSX from 'xlsx';

interface CheckInRecord {
  id: number;
  employeeName: string;
  departmentName: string;
  avatar: string | null;
  checkInTime: string;
}

interface AbsenteeRecord {
  id: number;
  name: string;
  departmentName: string;
  avatar: string | null;
}

/** 将签到记录导出为 CSV 文件并触发下载 */
/** CSV 单元格转义：防公式注入 + 逗号/引号处理 */
function csvEscape(value: string): string {
  // 以 = + - @ 开头的值前加单引号，防 Excel 公式注入
  if (/^[=+\-@]/.test(value)) {
    value = "'" + value;
  }
  // 包含逗号、引号、换行时用双引号包裹
  if (/[",\n\r]/.test(value)) {
    value = '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function exportCSV(records: CheckInRecord[], meetingTitle: string) {
  // BOM 确保 Excel 正确识别中文编码
  const BOM = '﻿';
  const header = '序号,员工姓名,部门,签到时间';
  const rows = records.map((r, i) => {
    const time = new Date(r.checkInTime).toLocaleString('zh-CN');
    return [String(i + 1), r.employeeName, r.departmentName, time].map(csvEscape).join(',');
  });
  const csv = BOM + header + '\n' + rows.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = meetingTitle.replace(/[\\/:*?"<>|]/g, '-');
  a.download = `${safeTitle}-签到记录.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 将签到记录 + 缺席人员导出为 Excel 文件 */
function exportExcel(
  records: CheckInRecord[],
  absentees: AbsenteeRecord[],
  meetingTitle: string
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 签到记录
  const checkInData = [
    ['序号', '员工姓名', '部门', '签到时间'],
    ...records.map((r, i) => [
      i + 1,
      r.employeeName,
      r.departmentName,
      new Date(r.checkInTime).toLocaleString('zh-CN'),
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(checkInData);
  ws1['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, '签到记录');

  // Sheet 2: 缺席人员
  if (absentees.length > 0) {
    const absentData = [
      ['序号', '员工姓名', '部门'],
      ...absentees.map((a, i) => [i + 1, a.name, a.departmentName]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(absentData);
    ws2['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, '未签到人员');
  }

  const safeTitle = meetingTitle.replace(/[\\/:*?"<>|]/g, '-');
  XLSX.writeFile(wb, `${safeTitle}-签到明细.xlsx`);
}

export default function CheckInsPage() {
  const { id } = useParams<{ id: string }>();
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [absentees, setAbsentees] = useState<AbsenteeRecord[]>([]);
  const [meeting, setMeeting] = useState<{ title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [totalShouldAttend, setTotalShouldAttend] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch(`/api/admin/meetings/${id}/checkins`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRecords(data.data.records);
          setAbsentees(data.data.absentees || []);
          setMeeting(data.data.meeting);
          setAttendanceRate(data.data.attendanceRate || 0);
          setTotalShouldAttend(data.data.totalShouldAttend || 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // 搜索过滤
  const filterBySearch = <T extends { employeeName?: string; name?: string; departmentName: string }>(items: T[]) => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) => {
      const nameField = ('employeeName' in item ? item.employeeName : item.name) || '';
      return nameField.toLowerCase().includes(q) || item.departmentName.toLowerCase().includes(q);
    });
  };

  const filteredRecords = filterBySearch(records);
  const filteredAbsentees = filterBySearch(absentees);

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">{meeting?.title || '签到明细'}</h1>
        {records.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => exportCSV(records, meeting?.title || '签到记录')}
              className="text-sm border border-green-500 text-green-600 px-3 py-1.5 rounded hover:bg-green-50 transition-colors"
            >
              📄 CSV
            </button>
            <button
              onClick={() => exportExcel(records, absentees, meeting?.title || '签到记录')}
              className="text-sm border border-green-500 text-green-600 px-3 py-1.5 rounded hover:bg-green-50 transition-colors"
            >
              📊 Excel
            </button>
          </div>
        )}
      </div>

      {/* 统计摘要 */}
      {totalShouldAttend > 0 && (
        <div className="flex gap-4 mb-6">
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm text-center flex-1">
            <div className="text-lg font-bold text-gray-800">{totalShouldAttend}</div>
            <div className="text-xs text-gray-500">应到</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm text-center flex-1">
            <div className="text-lg font-bold text-green-600">{records.length}</div>
            <div className="text-xs text-gray-500">实到</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm text-center flex-1">
            <div className={`text-lg font-bold ${
              attendanceRate >= 80 ? 'text-green-600' : attendanceRate >= 50 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {attendanceRate}%
            </div>
            <div className="text-xs text-gray-500">签到率</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm text-center flex-1">
            <div className="text-lg font-bold text-red-500">{absentees.length}</div>
            <div className="text-xs text-gray-500">缺席</div>
          </div>
        </div>
      )}

      {records.length === 0 && absentees.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">📭</p>
          <p>暂无签到记录</p>
        </div>
      ) : (
        <>
          {/* 搜索框 */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索员工姓名或部门..."
              className="w-full max-w-xs border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* 已签到表格 */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <h2 className="px-4 py-3 font-semibold text-gray-700 border-b">
              已签到 ({filteredRecords.length}{search ? `/${records.length}` : ''}人)
            </h2>
            {filteredRecords.length === 0 ? (
              <p className="px-4 py-8 text-center text-gray-400 text-sm">
                {search ? '无匹配结果' : '暂无签到'}
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm text-gray-500">
                    <th className="px-4 py-3">员工</th>
                    <th className="px-4 py-3">部门</th>
                    <th className="px-4 py-3">签到时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3 flex items-center gap-3">
                        {r.avatar ? (
                          <img src={r.avatar} alt={r.employeeName} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">
                            {r.employeeName.charAt(0)}
                          </div>
                        )}
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
            )}
          </div>

          {/* 缺席表格 */}
          {absentees.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <h2 className="px-4 py-3 font-semibold text-gray-700 border-b">
                未签到 ({filteredAbsentees.length}{search ? `/${absentees.length}` : ''}人)
              </h2>
              {filteredAbsentees.length === 0 ? (
                <p className="px-4 py-8 text-center text-gray-400 text-sm">无匹配结果</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left text-sm text-gray-500">
                      <th className="px-4 py-3">员工</th>
                      <th className="px-4 py-3">部门</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAbsentees.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-4 py-3 flex items-center gap-3">
                          {a.avatar ? (
                            <img src={a.avatar} alt={a.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-sm font-bold">
                              {a.name.charAt(0)}
                            </div>
                          )}
                          <span>{a.name}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{a.departmentName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
