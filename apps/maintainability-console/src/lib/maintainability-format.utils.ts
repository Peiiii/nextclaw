const integerFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
});
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return integerFormatter.format(Math.round(value));
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

export function formatDuration(value: number): string {
  if (value < 1000) {
    return `${formatInteger(value)} ms`;
  }
  return `${(value / 1000).toFixed(2)} s`;
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatShortHash(value: string | null): string {
  if (!value) {
    return "未检测到 Git HEAD";
  }
  return `Git ${value.slice(0, 7)}`;
}
