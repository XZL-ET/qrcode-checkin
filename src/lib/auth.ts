import { SignJWT, jwtVerify } from 'jose';
import type { AdminPayload } from '@/types';
import { getAccessToken } from '@/lib/wework-api';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  // 拒绝弱密钥，防止部署时忘记修改默认值
  const lower = secret.toLowerCase();
  const isWeak =
    secret.length < 16 ||
    ['change-me-to-a-random-string', 'your-secret-key', 'secret'].includes(secret) ||
    lower.startsWith('change-me') ||
    lower.startsWith('your-') ||
    lower.includes('placeholder') ||
    lower === 'password' ||
    lower === '1234567890abcdef';
  if (isWeak) {
    throw new Error(
      'JWT_SECRET is too weak or is a known default. ' +
      'Generate a strong random string (at least 32 characters) for production.'
    );
  }

  return new TextEncoder().encode(secret);
};

export async function signAdminToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as AdminPayload;
}

/** 签到确认临时 token 的载荷：预览接口 OAuth 验证通过后签发，确认接口验证 */
export interface CheckInTokenPayload {
  meetingId: number;
  employeeId: number;
}

export async function signCheckInToken(payload: CheckInTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2m')
    .sign(getSecret());
}

export async function verifyCheckInToken(token: string): Promise<CheckInTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as CheckInTokenPayload;
}

// 企微 OAuth: code 换取 userid
// 使用缓存的 access_token，避免高并发签到时每个请求都调 gettoken 被企微限频
export async function getWeWorkUserId(code: string): Promise<string> {
  const corpId = process.env.WEWORK_CORP_ID;
  const corpSecret = process.env.WEWORK_CORP_SECRET;

  if (!corpId || !corpSecret) {
    throw new Error('WeWork credentials not configured');
  }

  // 使用全局缓存的 access_token，而非每次请求新 token
  // getAccessToken 内部有并发控制：同时到达的请求共享同一次 gettoken 调用
  const accessToken = await getAccessToken();

  // code 换取 userid（带超时，防止企微 API 无响应导致请求挂起）
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10 秒超时

  try {
    const userRes = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${accessToken}&code=${code}`,
      { signal: controller.signal }
    );
    const userData = await userRes.json();

    if (userData.errcode !== 0) {
      throw new Error(`Failed to get userid: ${userData.errmsg}`);
    }

    // 企微 API 返回的用户标识字段有大小写变体
    const userId = userData.UserId || userData.userid || userData.openid;

    return userId;
  } finally {
    clearTimeout(timeout);
  }
}

// 生成企微 OAuth 授权 URL
export function getWeWorkOAuthUrl(redirectUri: string, state: string): string {
  const corpId = process.env.WEWORK_CORP_ID;
  const agentId = process.env.WEWORK_AGENT_ID;
  const encoded = encodeURIComponent(redirectUri);
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${encoded}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=${state}#wechat_redirect`;
}
