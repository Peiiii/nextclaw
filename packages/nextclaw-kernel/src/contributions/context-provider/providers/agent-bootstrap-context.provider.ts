import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import { truncateContextText } from "@kernel/contributions/context-provider/utils/context-text.utils.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import type { Config } from "@nextclaw/core";

type BootstrapContextConfig = Config["agents"]["context"]["bootstrap"];
type BootstrapReadBudget = {
  remaining: number;
};

export class AgentBootstrapContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { contextConfig, projectContext, runContext } =
      await this.context.resolve(request);
    const budget = this.createReadBudget(contextConfig.bootstrap);
    const agentBootstrapRoot =
      projectContext.projectBootstrapRoot ?? projectContext.effectiveWorkspace;
    const projectBootstrap = this.loadBootstrapFiles({
      root: agentBootstrapRoot,
      config: contextConfig.bootstrap,
      sessionKey: runContext.sessionKey,
      budget,
    });
    const hasDistinctHostWorkspace =
      projectContext.hostWorkspace !== agentBootstrapRoot;
    const workspaceBootstrap = hasDistinctHostWorkspace
      ? this.loadBootstrapFiles({
          root: projectContext.hostWorkspace,
          config: contextConfig.bootstrap,
          sessionKey: runContext.sessionKey,
          budget,
        })
      : "";
    const hasSoulFile = /##\s+SOUL\.md\b/i.test(
      `${projectBootstrap}\n${workspaceBootstrap}`,
    );
    const sections = [
      this.buildBootstrapSection({
        content: projectBootstrap,
        emptyLabel: "No agent bootstrap files were found.",
        includeSoulRule: hasSoulFile,
        loadedLabel: "Agent bootstrap files loaded:",
        rootLine: `Agent bootstrap root: ${agentBootstrapRoot}`,
        title: "# Agent Bootstrap Context",
      }),
    ];

    if (hasDistinctHostWorkspace) {
      sections.push(
        this.buildBootstrapSection({
          content: workspaceBootstrap,
          emptyLabel:
            "No bootstrap files were found in the NextClaw workspace directory.",
          loadedLabel: "NextClaw workspace bootstrap files loaded:",
          rootLine: `NextClaw workspace directory: ${projectContext.hostWorkspace}`,
          title: "# NextClaw Workspace Bootstrap Context",
        }),
      );
    }

    return [sections.filter(Boolean).join("\n\n")];
  };

  private buildBootstrapSection = (params: {
    content: string;
    emptyLabel: string;
    includeSoulRule?: boolean;
    loadedLabel: string;
    rootLine: string;
    title: string;
  }): string => {
    const {
      content,
      emptyLabel,
      includeSoulRule,
      loadedLabel,
      rootLine,
      title,
    } = params;
    const lines = [title, "", rootLine];

    if (includeSoulRule) {
      lines.push(
        "If SOUL.md is present, embody its persona and tone unless higher-priority instructions override it.",
      );
    }

    if (content) {
      lines.push("", loadedLabel, "", content);
    } else {
      lines.push("", emptyLabel);
    }

    return lines.join("\n");
  };

  private loadBootstrapFiles = (params: {
    root: string;
    config: BootstrapContextConfig;
    sessionKey?: string;
    budget: BootstrapReadBudget;
  }): string => {
    const { budget, config, root, sessionKey } = params;
    const parts: string[] = [];
    const fileList = this.selectBootstrapFiles(config, sessionKey);

    for (const filename of fileList) {
      const filePath = join(root, filename);
      if (!existsSync(filePath)) {
        continue;
      }

      const raw = readFileSync(filePath, "utf-8").trim();
      if (!raw) {
        continue;
      }

      const perFileLimit =
        config.perFileChars > 0 ? config.perFileChars : raw.length;
      const allowed = Math.min(perFileLimit, budget.remaining);
      if (allowed <= 0) {
        break;
      }

      const content = truncateContextText(raw, allowed);
      parts.push(`## ${filename}\n\n${content}`);
      budget.remaining -= content.length;
      if (budget.remaining <= 0) {
        break;
      }
    }

    return parts.join("\n\n");
  };

  private createReadBudget = (
    config: BootstrapContextConfig,
  ): BootstrapReadBudget => ({
    remaining:
      config.totalChars > 0 ? config.totalChars : Number.POSITIVE_INFINITY,
  });

  private selectBootstrapFiles = (
    config: BootstrapContextConfig,
    sessionKey?: string,
  ): string[] => {
    if (!sessionKey) {
      return config.files;
    }
    if (sessionKey.startsWith("cron:") || sessionKey.startsWith("subagent:")) {
      return config.minimalFiles;
    }
    return config.files;
  };
}
