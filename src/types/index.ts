// API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 管理员 JWT payload
export interface AdminPayload {
  adminId: number;
  username: string;
}

// 企微 OAuth 结果
export interface WeWorkOAuthResult {
  userid: string;
  errcode: number;
  errmsg: string;
}

// 企微成员信息
export interface WeWorkMember {
  userid: string;
  name: string;
  department: number[];
  mobile: string;
  avatar: string;
}

// 签到预览数据
export interface CheckInPreview {
  meeting: {
    id: number;
    title: string;
    location: string | null;
    startTime: string;
  };
  employee: {
    id: number;
    name: string;
    department: string | null;
    avatar: string | null;
  };
  alreadyCheckedIn: boolean;
  meetingStatus: string;
}

// 签到统计
export interface CheckInStats {
  totalMeetings: number;
  activeMeetings: number;
  totalCheckIns: number;
  avgRate: number;
}
