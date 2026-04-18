import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config/schema.js";
import type { SessionProjectContext } from "../session/session-project-context.js";
import {
  DEFAULT_WORKSPACE_REPOSITORY_IDENTITY_RESOLVER,
  type WorkspaceRepositoryIdentity,
} from "./workspace-repository-identity.service.js";

type ContextConfig = Config["agents"]["context"];
type BootstrapContextConfig = ContextConfig["bootstrap"];
type BootstrapReadBudget = {
  remaining: number;
};

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

export const DEFAULT_BOOTSTRAP_CONTEXT_CONFIG: BootstrapContextConfig = {
  files: ["AGENTS.md", "SOUL.md", "USER.md", "IDENTITY.md", "TOOLS.md", "BOOT.md", "BOOTSTRAP.md", "HEARTBEAT.md"],
  minimalFiles: ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md"],
  heartbeatFiles: ["HEARTBEAT.md"],
  perFileChars: 4000,
  totalChars: 12000,
};

export class BootstrapContextBuilder {
  resolveConfig = (
    contextConfig?: ContextConfig,
  ): BootstrapContextConfig => {
    return {
      ...DEFAULT_BOOTSTRAP_CONTEXT_CONFIG,
      ...(contextConfig?.bootstrap ?? {}),
    };
  };

  buildWorkspaceProjectContextSection = (params: {
    projectContext: SessionProjectContext;
    contextConfig?: ContextConfig;
    sessionKey?: string;
  }): string => {
    const budget = this.createReadBudget(params.contextConfig);
    const projectBootstrap = this.loadBootstrapFiles({
      workspace: params.projectContext.effectiveWorkspace,
      root: params.projectContext.projectBootstrapRoot ?? params.projectContext.effectiveWorkspace,
      contextConfig: params.contextConfig,
      sessionKey: params.sessionKey,
      budget,
    });
    const hasDistinctHostWorkspace =
      params.projectContext.hostWorkspace !== params.projectContext.effectiveWorkspace;
    const repositoryIdentity = DEFAULT_WORKSPACE_REPOSITORY_IDENTITY_RESOLVER.resolve(
      params.projectContext.effectiveWorkspace,
    );
    const hostBootstrap = hasDistinctHostWorkspace
      ? this.loadBootstrapFiles({
          workspace: params.projectContext.hostWorkspace,
          root: params.projectContext.hostWorkspace,
          contextConfig: params.contextConfig,
          sessionKey: params.sessionKey,
          budget,
        })
      : "";
    const hasSoulFile = /##\s+SOUL\.md\b/i.test(`${projectBootstrap}\n${hostBootstrap}`);
    const sections = [
      this.buildProjectSection({
        projectContext: params.projectContext,
        projectBootstrap,
        hasSoulFile,
        repositoryIdentity,
      }),
    ];

    if (hasDistinctHostWorkspace) {
      sections.push(
        this.buildHostWorkspaceSection({
          hostWorkspace: params.projectContext.hostWorkspace,
          hostBootstrap,
        }),
      );
    }

    return sections.filter(Boolean).join("\n\n");
  };

  private buildProjectSection = (params: {
    projectContext: SessionProjectContext;
    projectBootstrap: string;
    hasSoulFile: boolean;
    repositoryIdentity: WorkspaceRepositoryIdentity;
  }): string => {
    const lines = [
      "# Project Context",
      "",
      `Active project directory: ${params.projectContext.effectiveWorkspace}`,
    ];

    if (params.projectContext.projectRoot) {
      lines.push(
        `Session-bound project root: ${params.projectContext.projectRoot}`,
        "This session is explicitly bound to that project directory. Use it as the primary repo and file-operation context for the user's work.",
      );
    } else {
      lines.push(
        "No explicit session project root is set. Use the active project directory as the primary repo and file-operation context for the user's work.",
      );
    }

    lines.push(...this.buildRepositoryIdentityLines(params.repositoryIdentity));

    if (params.hasSoulFile) {
      lines.push(
        "If SOUL.md is present, embody its persona and tone unless higher-priority instructions override it.",
      );
    }

    if (params.projectBootstrap) {
      lines.push(
        "",
        "Project bootstrap files loaded:",
        "",
        params.projectBootstrap,
      );
    } else {
      lines.push("", "No bootstrap context files were found in the active project directory.");
    }

    return lines.join("\n");
  };

  private buildRepositoryIdentityLines = (
    repositoryIdentity: WorkspaceRepositoryIdentity,
  ): string[] => {
    if (!repositoryIdentity.repoRoot) {
      return [
        "No Git repository metadata was detected for the active project directory. Do not assume external repository URLs refer to this project unless the user explicitly says so.",
      ];
    }

    const lines = [`Repository root: ${repositoryIdentity.repoRoot}`];

    if (repositoryIdentity.canonicalWebUrl) {
      lines.push(`Canonical repository: ${repositoryIdentity.canonicalWebUrl}`);
    } else if (repositoryIdentity.canonicalRemoteUrl) {
      const remoteLabel = repositoryIdentity.canonicalRemoteName
        ? ` (${repositoryIdentity.canonicalRemoteName})`
        : "";
      lines.push(`Canonical git remote${remoteLabel}: ${repositoryIdentity.canonicalRemoteUrl}`);
    }

    lines.push(
      "Repository identity rule: treat any other repository URL mentioned in this context as an external reference unless it exactly matches the canonical repository above.",
    );

    return lines;
  };

  private buildHostWorkspaceSection = (params: {
    hostWorkspace: string;
    hostBootstrap: string;
  }): string => {
    const lines = [
      "# Host Workspace Context",
      "",
      `NextClaw host workspace directory: ${params.hostWorkspace}`,
      "This host workspace remains relevant for runtime memory, workspace-local skills, and host bootstrap context.",
    ];

    if (params.hostBootstrap) {
      lines.push(
        "",
        "Host workspace bootstrap files loaded:",
        "",
        params.hostBootstrap,
      );
    } else {
      lines.push("", "No bootstrap context files were found in the host workspace directory.");
    }

    return lines.join("\n");
  };

  private loadBootstrapFiles = (params: {
    workspace: string;
    root: string;
    contextConfig?: ContextConfig;
    sessionKey?: string;
    budget: BootstrapReadBudget;
  }): string => {
    const parts: string[] = [];
    const { perFileChars } = this.resolveConfig(params.contextConfig);
    const fileList = this.selectBootstrapFiles(params.contextConfig, params.sessionKey);

    for (const filename of fileList) {
      const filePath = join(params.root, filename);
      if (!existsSync(filePath)) {
        continue;
      }

      const raw = readFileSync(filePath, "utf-8").trim();
      if (!raw) {
        continue;
      }

      const perFileLimit = perFileChars > 0 ? perFileChars : raw.length;
      const allowed = Math.min(perFileLimit, params.budget.remaining);
      if (allowed <= 0) {
        break;
      }

      const content = truncateText(raw, allowed);
      parts.push(`## ${filename}\n\n${content}`);
      params.budget.remaining -= content.length;
      if (params.budget.remaining <= 0) {
        break;
      }
    }

    return parts.join("\n\n");
  };

  private createReadBudget = (contextConfig?: ContextConfig): BootstrapReadBudget => {
    const { totalChars } = this.resolveConfig(contextConfig);
    return {
      remaining: totalChars > 0 ? totalChars : Number.POSITIVE_INFINITY,
    };
  };

  private selectBootstrapFiles = (
    contextConfig?: ContextConfig,
    sessionKey?: string,
  ): string[] => {
    const { files, minimalFiles, heartbeatFiles } = this.resolveConfig(contextConfig);
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
  };
}

export const DEFAULT_BOOTSTRAP_CONTEXT_BUILDER = new BootstrapContextBuilder();

export function resolveBootstrapContextConfig(
  contextConfig?: ContextConfig,
): BootstrapContextConfig {
  return DEFAULT_BOOTSTRAP_CONTEXT_BUILDER.resolveConfig(contextConfig);
}

export function buildWorkspaceProjectContextSection(params: {
  projectContext: SessionProjectContext;
  contextConfig?: ContextConfig;
  sessionKey?: string;
}): string {
  return DEFAULT_BOOTSTRAP_CONTEXT_BUILDER.buildWorkspaceProjectContextSection(params);
}
