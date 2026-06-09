import { SignJWT, jwtVerify } from 'jose';
import type { AdminPayload } from '@/types';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(secret);
};

export async function signAdminToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as AdminPayload;
}

// 企微 OAuth: code 换取 userid
export async function getWeWorkUserId(code: string): Promise<string> {
  const corpId = process.env.WEWORK_CORP_ID;
  const corpSecret = process.env.WEWORK_CORP_SECRET;

  if (!corpId || !corpSecret) {
    throw new Error('WeWork credentials not configured');
  }

  // 获取 access_token
  const tokenRes = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`
  );
  const tokenData = await tokenRes.json();

  if (tokenData.errcode !== 0) {
    throw new Error(`Failed to get access_token: ${tokenData.errmsg}`);
  }

  // code 换取 userid
  const userRes = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${tokenData.access_token}&code=${code}`
  );
  const userData = await userRes.json();

  if (userData.errcode !== 0) {
    throw new Error(`Failed to get userid: ${userData.errmsg}`);
  }

  // 企微 API 返回的用户标识字段有大小写变体
  const userId = userData.UserId || userData.userid || userData.openid;
  console.log('[auth] getWeWorkUserId raw response:', JSON.stringify(userData));
  console.log('[auth] getWeWorkUserId resolved userid:', userId);

  return userId;
}

// 生成企微 OAuth 授权 URL
export function getWeWorkOAuthUrl(redirectUri: string, state: string): string {
  const corpId = process.env.WEWORK_CORP_ID;
  const agentId = process.env.WEWORK_AGENT_ID;
  const encoded = encodeURIComponent(redirectUri);
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${encoded}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=${state}#wechat_redirect`;
}
