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

  // 非企微环境 → 标记让前端展示下载引导
  if (!isWeWork) {
    const url = request.nextUrl.clone();
    url.searchParams.set('non_wxwork', '1');
    return NextResponse.rewrite(url);
  }

  // 企微环境 → 检查是否有 OAuth code，没有则跳转授权
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    const corpId = process.env.WEWORK_CORP_ID;
    const agentId = process.env.WEWORK_AGENT_ID;
    const redirectUri = encodeURIComponent(request.nextUrl.href);

    if (corpId && agentId) {
      const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=checkin#wechat_redirect`;
      return NextResponse.redirect(authUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/checkin/:path*',
};
