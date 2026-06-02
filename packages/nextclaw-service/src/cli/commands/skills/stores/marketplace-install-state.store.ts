import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type MarketplaceSkillUpdateStatus = "outdated" | "up-to-date" | "unknown";

export const MARKETPLACE_INSTALL_STATE_FILE = ".nextclaw-install.json";
const LEGACY_MARKETPLACE_INSTALL_STATE_FILE = ".nextclaw-marketplace.json";

export type MarketplaceSkillInstallStateFileEntry = {
  path: string;
  sha256: string;
};

export type MarketplaceSkillInstallState = {
  schemaVersion: 1;
  type: "skill";
  source: "marketplace";
  slug: string;
  packageName?: string;
  apiBaseUrl: string;
  installedAt: string;
  marketplaceUpdatedAt?: string;
  files: MarketplaceSkillInstallStateFileEntry[];
};

export function hashMarketplaceFileBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isLocalMarketplaceInstallStateFile(path: string): boolean {
  const normalized = normalizeMarketplaceRelativePath(path);
  return normalized === MARKETPLACE_INSTALL_STATE_FILE || normalized === LEGACY_MARKETPLACE_INSTALL_STATE_FILE;
}

export function buildMarketplaceSkillInstallState(params: {
  item: {
    slug: string;
    packageName?: string;
    updatedAt?: string;
  };
  apiBase: string;
  files: MarketplaceSkillInstallStateFileEntry[];
}): MarketplaceSkillInstallState {
  const { apiBase, files, item } = params;
  return {
    schemaVersion: 1,
    type: "skill",
    source: "marketplace",
    slug: item.slug,
    packageName: item.packageName,
    apiBaseUrl: apiBase,
    installedAt: new Date().toISOString(),
    marketplaceUpdatedAt: item.updatedAt,
    files,
  };
}

export function writeMarketplaceSkillInstallState(params: {
  destinationDir: string;
  state: MarketplaceSkillInstallState;
}): void {
  const { destinationDir, state } = params;
  writeFileSync(
    join(destinationDir, MARKETPLACE_INSTALL_STATE_FILE),
    `${JSON.stringify(state, null, 2)}\n`
  );
}

export function readMarketplaceSkillInstallState(destinationDir: string): MarketplaceSkillInstallState | null {
  const statePath = [MARKETPLACE_INSTALL_STATE_FILE, LEGACY_MARKETPLACE_INSTALL_STATE_FILE]
    .map((file) => join(destinationDir, file))
    .find((path) => existsSync(path));
  if (!statePath) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Partial<MarketplaceSkillInstallState>;
    if (
      parsed.schemaVersion !== 1
      || parsed.type !== "skill"
      || parsed.source !== "marketplace"
      || typeof parsed.slug !== "string"
      || !Array.isArray(parsed.files)
    ) {
      return null;
    }
    return parsed as MarketplaceSkillInstallState;
  } catch {
    return null;
  }
}

export function hasLocalMarketplaceSkillDrift(destinationDir: string, state: MarketplaceSkillInstallState): boolean {
  return state.files.some((file) => {
    const targetPath = resolve(destinationDir, ...file.path.split("/"));
    if (!existsSync(targetPath)) {
      return true;
    }
    return hashMarketplaceFileBytes(readFileSync(targetPath)) !== file.sha256;
  });
}

export function resolveMarketplaceSkillUpdateStatus(
  state: MarketplaceSkillInstallState | null,
  remoteUpdatedAt: string | undefined
): MarketplaceSkillUpdateStatus {
  if (!state || !state.marketplaceUpdatedAt || !remoteUpdatedAt) {
    return "unknown";
  }
  return Date.parse(remoteUpdatedAt) > Date.parse(state.marketplaceUpdatedAt)
    ? "outdated"
    : "up-to-date";
}

function normalizeMarketplaceRelativePath(path: string): string {
  return path.replace(/\\/g, "/");
}
