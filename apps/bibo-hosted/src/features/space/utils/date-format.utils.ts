export const day = (value: string) =>
  new Date(value).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
export const datetime = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const localInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
