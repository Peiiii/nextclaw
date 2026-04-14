export function formatDateTime(dateText: string): string {
  const date = new Date(dateText);
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatScore(score: number | null): string {
  if (score === null) {
    return "Not Ranked";
  }
  return `${score.toFixed(1)} / 100`;
}

export function formatComparability(comparability: string): string {
  if (comparability === "core") {
    return "Core Comparable";
  }
  if (comparability === "adjacent") {
    return "Adjacent Alternative";
  }
  return "Derivative / Watch";
}

export function formatConfidence(confidence: string): string {
  if (confidence === "high") {
    return "高";
  }
  if (confidence === "medium") {
    return "中";
  }
  return "低";
}

export function formatCapabilityStatus(status: string): string {
  if (status === "yes") {
    return "Yes";
  }
  if (status === "partial") {
    return "Partial";
  }
  return "No";
}
