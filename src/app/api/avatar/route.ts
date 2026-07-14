import { NextResponse } from 'next/server';

/** 代理企微头像，解决原始 URL 过期问题 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { success: false, error: '缺少 url 参数' },
      { status: 400 }
    );
  }

  // 域名白名单，防止被用作开放代理
  try {
    const parsed = new URL(url);
    const allowedHosts = [
      'wx.qlogo.cn',
      'thirdwx.qlogo.cn',
      'wework.qpic.cn',
      'p.qlogo.cn',
    ];
    if (!allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith('.' + host))) {
      return NextResponse.json(
        { success: false, error: '不允许的头像域名' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: '无效的 URL' },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10 秒超时

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: '获取头像失败' },
        { status: 502 }
      );
    }

    // 仅允许已知图片类型
    const contentType = response.headers.get('content-type') || '';
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.some((t) => contentType.startsWith(t))) {
      return NextResponse.json(
        { success: false, error: '不支持的文件类型' },
        { status: 400 }
      );
    }

    // 限制响应大小 5MB
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '文件过大' },
        { status: 400 }
      );
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json(
        { success: false, error: '获取头像超时' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { success: false, error: '获取头像失败' },
      { status: 502 }
    );
  }
}
