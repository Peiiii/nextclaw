import path from "node:path";

const normalizePath = (value) => value
  .split(path.sep)
  .join(path.posix.sep)
  .replace(/^\.\/+/, "")
  .replace(/\/+$/, "");

export const STRICT_TOUCHED_LEGACY_SOURCE_PATHS = [
  "apps/platform-admin/src/pages",
  "apps/platform-console/src/pages",
  "packages/nextclaw-core/src/providers",
  "packages/nextclaw-ui/src/components/chat"
];

export const STRICT_TOUCHED_FLAT_DIRECTORY_PATHS = [
  "packages/nextclaw-ui/src/components/chat",
  "workers/nextclaw-provider-gateway-api/src"
];

export const DOC_NAMING_ROOTS = [
  "commands",
  "docs",
  "apps/docs"
];

export const STRICT_TOUCHED_LEGACY_DOC_PATHS = [
  "commands",
  "docs/internal",
  "docs/plans",
  "docs/workflows",
  "apps/docs/en",
  "apps/docs/zh"
];

export const GOVERNANCE_BACKLOG_BASELINE_PATH = "governance/governance-backlog-baseline.json";

export const isPathWithinPrefixes = (filePath, prefixes) => {
  const normalizedFilePath = normalizePath(filePath);
  return prefixes
    .map((prefix) => normalizePath(prefix))
    .filter(Boolean)
    .some((prefix) => normalizedFilePath === prefix || normalizedFilePath.startsWith(`${prefix}/`));
};

export const normalizeGovernancePath = normalizePath;
