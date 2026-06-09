import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  // 只处理签到页面
  if (!pathname.startsWith('/checkin/')) {
    return NextResponse.next();
  }

  const isWeWork = userAgent.toLowerCase().includes('wxwork');

  // 非企微环境 → 重定向让前端展示下载引导
  if (!isWeWork) {
    const alreadyMarked = request.nextUrl.searchParams.has('non_wxwork');
    if (!alreadyMarked) {
      const url = request.nextUrl.clone();
      url.searchParams.set('non_wxwork', '1');
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 企微环境 → 检查是否有 OAuth code，没有则跳转授权
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    const corpId = process.env.WEWORK_CORP_ID;
    const agentId = process.env.WEWORK_AGENT_ID;

    if (corpId && agentId) {
      // 用外部域名构建 redirect_uri（不能用容器内部地址）
      const xProto = request.headers.get('x-forwarded-proto') || 'https';
      const xHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
      const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `${xProto}://${xHost}`;
      const externalUrl = `${baseUrl}${request.nextUrl.pathname}${request.nextUrl.search}`;
      const redirectUri = encodeURIComponent(externalUrl);

      const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=checkin#wechat_redirect`;
      return NextResponse.redirect(authUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/checkin/:path*',
};
