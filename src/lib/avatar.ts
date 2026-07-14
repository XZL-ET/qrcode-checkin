/**
 * 将企微头像原始 URL 替换为代理 URL，避免头像链接过期。
 * 如果 avatar 为空，返回 null。
 */
export function proxyAvatarUrl(avatar: string | null): string | null {
  if (!avatar) return null;
  return `/api/avatar?url=${encodeURIComponent(avatar)}`;
}
