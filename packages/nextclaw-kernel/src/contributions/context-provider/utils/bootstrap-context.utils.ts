import type { Config } from "@nextclaw/core";
import { shouldSkipCompactedSessionBootstrapFile } from "@kernel/utils/agent-onboarding-context.utils.js";
import { truncateContextText } from "./context-text.utils.js";

export type BootstrapContextInput = {
  config: Config["agents"]["context"]["bootstrap"];
  agentRoot: string;
  workspaceRoot: string;
  sessionKey?: string;
  compacted: boolean;
  readText(root: string, filename: string): string | Promise<string>;
};

function selectFiles(input: BootstrapContextInput): readonly string[] {
  if (input.sessionKey?.startsWith("cron:") || input.sessionKey?.startsWith("subagent:")) {
    return input.config.minimalFiles;
  }
  return input.compacted
    ? input.config.files.filter((name) => !shouldSkipCompactedSessionBootstrapFile(name, ""))
    : input.config.files;
}

async function loadFiles(input: BootstrapContextInput, root: string, budget: { remaining: number }): Promise<string> {
  const parts: string[] = [];
  for (const filename of selectFiles(input)) {
    const raw = (await input.readText(root, filename)).trim();
    if (!raw || input.compacted && shouldSkipCompactedSessionBootstrapFile(filename, raw)) continue;
    const perFileLimit = input.config.perFileChars > 0 ? input.config.perFileChars : raw.length;
    const allowed = Math.min(perFileLimit, budget.remaining);
    if (allowed <= 0) break;
    const content = truncateContextText(raw, allowed);
    parts.push(`## ${filename}\n\n${content}`);
    budget.remaining -= content.length;
    if (budget.remaining <= 0) break;
  }
  return parts.join("\n\n");
}

function section(input: {
  content: string; emptyLabel: string; loadedLabel: string; rootLine: string;
  title: string; includeSoulRule?: boolean;
}): string {
  const lines = [input.title, "", input.rootLine];
  if (input.includeSoulRule) {
    lines.push("If SOUL.md is present, embody its persona and tone unless higher-priority instructions override it.");
  }
  lines.push("", ...(input.content ? [input.loadedLabel, "", input.content] : [input.emptyLabel]));
  return lines.join("\n");
}

/** Shared bootstrap policy; the environment owns only reading the named text. */
export async function renderAgentBootstrapContext(input: BootstrapContextInput): Promise<string> {
  const budget = { remaining: input.config.totalChars > 0 ? input.config.totalChars : Number.POSITIVE_INFINITY };
  const agent = await loadFiles(input, input.agentRoot, budget);
  const distinctWorkspace = input.workspaceRoot !== input.agentRoot;
  const workspace = distinctWorkspace ? await loadFiles(input, input.workspaceRoot, budget) : "";
  const sections = [section({
    content: agent, emptyLabel: "No agent bootstrap files were found.",
    includeSoulRule: /##\s+SOUL\.md\b/i.test(`${agent}\n${workspace}`),
    loadedLabel: "Agent bootstrap files loaded:", rootLine: `Agent bootstrap root: ${input.agentRoot}`,
    title: "# Agent Bootstrap Context",
  })];
  if (distinctWorkspace) sections.push(section({
    content: workspace, emptyLabel: "No bootstrap files were found in the NextClaw workspace directory.",
    loadedLabel: "NextClaw workspace bootstrap files loaded:",
    rootLine: `NextClaw workspace directory: ${input.workspaceRoot}`, title: "# NextClaw Workspace Bootstrap Context",
  }));
  return sections.join("\n\n");
}
