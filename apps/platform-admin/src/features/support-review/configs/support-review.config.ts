export const reviewBuckets = [
  ['review', '待评审'], ['working', '处理中'], ['ready', '待发布'],
  ['waiting', '待补充'], ['closed', '已结束'], ['all', '全部']
] as const;
export const supportStatuses = { received: '已收到', 'needs-info': '待补充', 'needs-decision': '待评审', working: '处理中', ready: '待发布', published: '已发布', resolved: '已处理', withdrawn: '已撤回' };
export const reviewLabels = { repair: '已批准修复', deliver: '已批准发布', 'needs-info': '已要求补充', reject: '已结束处理', revoke: '已撤销批准' };
export function receivedAgo(date: string): string {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 3600000));
  return hours < 1 ? '刚刚收到' : hours < 24 ? hours + ' 小时前收到' : Math.floor(hours / 24) + ' 天前收到';
}
