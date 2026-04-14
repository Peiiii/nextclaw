import type { PublicItemType, PublicPhase } from "@shared/public-roadmap-feedback-portal.types";

export const PUBLIC_PHASE_LABELS: Record<PublicPhase, string> = {
  considering: "Considering",
  planned: "Planned",
  building: "Building",
  reviewing: "Reviewing",
  shipped: "Shipped",
  closed: "Closed"
};

export const PUBLIC_PHASE_SUMMARIES: Record<PublicPhase, string> = {
  considering: "正在观察信号",
  planned: "已进入公开规划",
  building: "正在构建",
  reviewing: "验证与收尾",
  shipped: "已经交付",
  closed: "已关闭或合并"
};

export const PUBLIC_ITEM_TYPE_LABELS: Record<PublicItemType, string> = {
  feature: "Feature",
  bug: "Bug",
  improvement: "Improvement",
  research: "Research"
};

export function formatPortalDate(value: string | null): string {
  if (!value) {
    return "未发布";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}
