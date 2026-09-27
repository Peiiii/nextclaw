export const day = (value: string) =>
  new Date(value).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
export const datetime = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const inboxTime = (value: string, now = Date.now()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date(now);
  const elapsed = now - date.getTime();
  const days = (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    - Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86_400_000;
  if (elapsed >= 0 && days === 0) {
    if (elapsed < 60_000) return "刚刚";
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}分钟前`;
    return `${Math.floor(elapsed / 3_600_000)}小时前`;
  }
  if (days === 1) return "昨天";
  if (days > 1 && days < 7) return date.toLocaleDateString("zh-CN", { weekday: "long" });
  return date.toLocaleDateString("zh-CN", {
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" as const } : {}),
    month: "numeric", day: "numeric",
  });
};
export const localInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
