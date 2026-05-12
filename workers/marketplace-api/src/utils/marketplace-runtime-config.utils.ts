export type MarketplaceSkillAutoApprovalMode = "off" | "all";

export function parseMarketplaceCacheTtlSeconds(raw: string | undefined): number {
  if (!raw) {
    return 5;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 5;
  }
  return parsed;
}

export function parseMarketplaceSkillAutoApprovalMode(raw: string | undefined): MarketplaceSkillAutoApprovalMode {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized || normalized === "0" || normalized === "false" || normalized === "off") {
    return "off";
  }
  if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "all") {
    return "all";
  }
  throw new Error("MARKETPLACE_SKILL_AUTO_APPROVE must be one of: false, true, off, on, 0, 1, all");
}
