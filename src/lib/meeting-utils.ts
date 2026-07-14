/**
 * 根据会议开始/结束时间自动计算状态
 * - 未到开始时间 → pending (未开始)
 * - 在开始和结束之间 → active (进行中)
 * - 已过结束时间 → ended (已结束)
 * - 无结束时间时，开始后一直为 active
 */
export function computeMeetingStatus(
  startTime: Date | string,
  endTime?: Date | string | null
): 'pending' | 'active' | 'ended' {
  const now = new Date();
  const start = new Date(startTime);

  if (now < start) {
    return 'pending';
  }

  if (endTime) {
    const end = new Date(endTime);
    if (now > end) {
      return 'ended';
    }
  }

  return 'active';
}
