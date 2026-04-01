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
  hostWorkspace?: string;
  projectRoot?: string | null;
  contextConfig?: ContextConfig;
  sessionKey?: string;
}): string {
  const bootstrap = loadWorkspaceBootstrapFiles(params);
  const hasSoulFile = /##\s+SOUL\.md\b/i.test(bootstrap);
  const hasBootstrap = bootstrap.trim().length > 0;
  const hasExplicitProjectRoot =
    typeof params.projectRoot === "string" && params.projectRoot.trim().length > 0;
  const currentProjectDirectory = params.workspace;
  const hostWorkspace =
    typeof params.hostWorkspace === "string" && params.hostWorkspace.trim().length > 0
      ? params.hostWorkspace.trim()
      : null;
  const shouldDescribeHostWorkspace =
    Boolean(hostWorkspace) && hostWorkspace !== currentProjectDirectory;
  const lines = [
    "# Project Context",
    "",
    `Current project directory: ${currentProjectDirectory}`,
  ];
  if (hasExplicitProjectRoot) {
    lines.push(
      "Treat this session-bound project directory as the primary project context for code understanding, file operations, and repo-aware reasoning.",
    );
  } else {
    lines.push(
      "Treat this directory as the current project context for code understanding, file operations, and repo-aware reasoning.",
    );
  }
  if (shouldDescribeHostWorkspace) {
    lines.push(
      `NextClaw workspace directory: ${hostWorkspace}`,
      "The NextClaw workspace is host environment context for runtime infrastructure and should not replace the current project directory unless both paths are the same.",
    );
  }
  if (hasSoulFile) {
    lines.push(
      "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
    );
  }
  if (hasBootstrap) {
    lines.push("", "The following project context files have been loaded:", "", bootstrap);
  } else {
    lines.push("", "No bootstrap context files were found in the current project directory.");
  }
  return lines.join("\n");
}

function loadWorkspaceBootstrapFiles(params: {
  workspace: string;
  hostWorkspace?: string;
  projectRoot?: string | null;
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
