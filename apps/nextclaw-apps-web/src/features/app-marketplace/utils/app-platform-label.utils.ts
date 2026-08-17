import type { AppItemSummary } from "@/features/app-marketplace/types/app-marketplace.types.js";

const LABELS: Record<"darwin" | "linux" | "win32", string> = {
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
};

export function formatAppPlatformLabel(
  availability: AppItemSummary["availability"],
): string {
  if (!availability || availability.mode === "universal") {
    return "全部平台";
  }
  return availability.operatingSystems.map((os) => LABELS[os]).join(" · ");
}
