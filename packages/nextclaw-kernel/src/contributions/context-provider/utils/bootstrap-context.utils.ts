import type { Config } from "@nextclaw/core";
import { shouldSkipCompactedSessionBootstrapFile } from "@kernel/utils/agent-onboarding-context.utils.js";
import { truncateContextText } from "./context-text.utils.js";

export type BootstrapContextInput = {
  config: Config["agents"]["context"]["bootstrap"];
  agentRoot: string;
  workspaceRoot: string;
  sessionKey?: string;
  compacted: boolean;
  readText(root: string, filename: string, maxChars?: number): string | Promise<string>;
  readTexts?(root: string, filenames: readonly string[], maxChars?: number): Promise<ReadonlyMap<string, string>>;
};

function selectFiles(input: BootstrapContextInput): readonly string[] {
  if (input.sessionKey?.startsWith("cron:") || input.sessionKey?.startsWith("subagent:")) {
    return input.config.minimalFiles;
  }
  return input.compacted
    ? input.config.files.filter((name) => !shouldSkipCompactedSessionBootstrapFile(name, ""))
    : input.config.files;
}

async function loadFiles(input: BootstrapContextInput, root: string, initialBudget: number): Promise<{ content: string; remaining: number }> {
  let remaining = initialBudget;
  const parts: string[] = [];
  const filenames = selectFiles(input);
  let batch: ReadonlyMap<string, string> | undefined;
  for (let index = 0; index < filenames.length; index++) {
    const filename = filenames[index]!;
    const readLimit = input.config.perFileChars > 0 ? input.config.perFileChars : remaining;
    if (input.readTexts && index % 4 === 0) {
      batch = await input.readTexts(root, filenames.slice(index, index + 4), Number.isFinite(readLimit) ? readLimit : undefined);
    }
    if (batch && !batch.has(filename)) throw new Error(`Context batch omitted requested file: ${filename}`);
    const raw = (batch ? batch.get(filename)! : await input.readText(root, filename)).trim();
    if (!raw || input.compacted && shouldSkipCompactedSessionBootstrapFile(filename, raw)) continue;
    const perFileLimit = input.config.perFileChars > 0 ? input.config.perFileChars : raw.length;
    const allowed = Math.min(perFileLimit, remaining);
    if (allowed <= 0) break;
    const content = truncateContextText(raw, allowed);
    parts.push(`## ${filename}\n\n${content}`);
    remaining -= content.length;
    if (remaining <= 0) break;
  }
  return { content: parts.join("\n\n"), remaining };
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
  const budget = input.config.totalChars > 0 ? input.config.totalChars : Number.POSITIVE_INFINITY;
  const agent = await loadFiles(input, input.agentRoot, budget);
  const distinctWorkspace = input.workspaceRoot !== input.agentRoot;
  const workspace = distinctWorkspace ? (await loadFiles(input, input.workspaceRoot, agent.remaining)).content : "";
  const sections = [section({
    content: agent.content, emptyLabel: "No agent bootstrap files were found.",
    includeSoulRule: /##\s+SOUL\.md\b/i.test(`${agent.content}\n${workspace}`),
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
