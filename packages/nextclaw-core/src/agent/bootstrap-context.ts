import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config/schema.js";

type ContextConfig = Config["agents"]["context"];
type BootstrapContextConfig = ContextConfig["bootstrap"];

export const DEFAULT_BOOTSTRAP_CONTEXT_CONFIG: BootstrapContextConfig = {
  files: ["AGENTS.md", "SOUL.md", "USER.md", "IDENTITY.md", "TOOLS.md", "BOOT.md", "BOOTSTRAP.md", "HEARTBEAT.md"],
  minimalFiles: ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md"],
  heartbeatFiles: ["HEARTBEAT.md"],
  perFileChars: 4000,
  totalChars: 12000,
};

export function resolveBootstrapContextConfig(
  contextConfig?: ContextConfig,
): BootstrapContextConfig {
  return {
    ...DEFAULT_BOOTSTRAP_CONTEXT_CONFIG,
    ...(contextConfig?.bootstrap ?? {}),
  };
}

export function buildWorkspaceProjectContextSection(params: {
  workspace: string;
  contextConfig?: ContextConfig;
  sessionKey?: string;
}): string {
  const bootstrap = loadWorkspaceBootstrapFiles(params);
  if (!bootstrap) {
    return "";
  }

  const hasSoulFile = /##\s+SOUL\.md\b/i.test(bootstrap);
  const lines = [
    "# Project Context",
    "",
    "The following project context files have been loaded:",
  ];
  if (hasSoulFile) {
    lines.push(
      "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
    );
  }
  lines.push("", bootstrap);
  return lines.join("\n");
}

function loadWorkspaceBootstrapFiles(params: {
  workspace: string;
  contextConfig?: ContextConfig;
  sessionKey?: string;
}): string {
  const parts: string[] = [];
  const { perFileChars, totalChars } = resolveBootstrapContextConfig(
    params.contextConfig,
  );
  const fileList = selectBootstrapFiles(params.contextConfig, params.sessionKey);
  const totalLimit = totalChars > 0 ? totalChars : Number.POSITIVE_INFINITY;
  let remaining = totalLimit;

  for (const filename of fileList) {
    const filePath = join(params.workspace, filename);
    if (!existsSync(filePath)) {
      continue;
    }

    const raw = readFileSync(filePath, "utf-8").trim();
    if (!raw) {
      continue;
    }

    const perFileLimit = perFileChars > 0 ? perFileChars : raw.length;
    const allowed = Math.min(perFileLimit, remaining);
    if (allowed <= 0) {
      break;
    }

    const content = truncateText(raw, allowed);
    parts.push(`## ${filename}\n\n${content}`);
    remaining -= content.length;
    if (remaining <= 0) {
      break;
    }
  }

  return parts.join("\n\n");
}

function selectBootstrapFiles(
  contextConfig?: ContextConfig,
  sessionKey?: string,
): string[] {
  const { files, minimalFiles, heartbeatFiles } = resolveBootstrapContextConfig(
    contextConfig,
  );
  if (!sessionKey) {
    return files;
  }
  if (sessionKey === "heartbeat") {
    return dedupeStrings([...minimalFiles, ...heartbeatFiles]);
  }
  if (sessionKey.startsWith("cron:") || sessionKey.startsWith("subagent:")) {
    return minimalFiles;
  }
  return files;
}

function truncateText(text: string, limit: number): string {
  if (limit <= 0 || text.length <= limit) {
    return text;
  }
  const omitted = text.length - limit;
  const suffix = `\n\n...[truncated ${omitted} chars]`;
  if (suffix.length >= limit) {
    return text.slice(0, limit).trimEnd();
  }
  const head = text.slice(0, limit - suffix.length).trimEnd();
  return `${head}${suffix}`;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}
