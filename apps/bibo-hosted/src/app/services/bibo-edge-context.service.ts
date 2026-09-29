import { hostedIdentity, preSearchIdentity } from "../utils/bibo-identity.utils";
import { shouldSkipCompactedSessionBootstrapFile } from "@nextclaw/kernel/onboarding-context";

const BOOTSTRAP_FILES = ["AGENTS.md", "SOUL.md", "USER.md", "IDENTITY.md", "TOOLS.md", "BOOT.md", "BOOTSTRAP.md"];
const PER_FILE_CHARS = 4_000;
const TOTAL_BOOTSTRAP_CHARS = 12_000;
const MEMORY_CHARS = 8_000;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const suffix = `\n\n...[truncated ${text.length - limit} chars]`;
  return suffix.length >= limit ? text.slice(0, limit).trimEnd() : `${text.slice(0, limit - suffix.length).trimEnd()}${suffix}`;
}

/** Bibo host input; NextClaw's shared model builder still owns projection and compaction. */
export async function buildBiboEdgeContext(storage: DurableObjectStorage, sessionId: string, searchEnabled = false, compacted = false): Promise<string[]> {
  const names = await storage.get<string[]>("edgeWorkspaceIndex") ?? [];
  const paths = new Set(names);
  const read = async (path: string) => paths.has(path) ? await storage.get<string>(`edgeWorkspace:${path}`) ?? "" : "";
  let remaining = TOTAL_BOOTSTRAP_CHARS;
  const bootstrap: string[] = [];
  for (const name of BOOTSTRAP_FILES) {
    if (compacted && shouldSkipCompactedSessionBootstrapFile(name, "")) continue;
    const raw = (await read(name)).trim() || (name === "IDENTITY.md" ? (searchEnabled ? hostedIdentity : preSearchIdentity).trim() : "");
    if (!raw || remaining <= 0 || (compacted && shouldSkipCompactedSessionBootstrapFile(name, raw))) continue;
    const content = truncate(raw, Math.min(PER_FILE_CHARS, remaining));
    bootstrap.push(`## ${name}\n\n${content}`);
    remaining -= content.length;
  }
  const memoryParts = [
    ["Workspace Memory", await read("MEMORY.md")],
    ["Long-term Memory", await read("memory/MEMORY.md")],
    ["Today's Notes", await read(`memory/${new Date().toISOString().slice(0, 10)}.md`)],
  ].flatMap(([title, content]) => content ? [`## ${title}\n${content}`] : []);
  return [
    ["## Safety", "You have no independent goals: do not pursue self-preservation, replication, resource acquisition, or power-seeking; avoid long-term plans beyond the user's request.",
      "Prioritize safety and human oversight over completion; if instructions conflict, pause and ask; comply with stop/pause/audit requests and never bypass safeguards. (Inspired by Anthropic's constitution.)",
      "Do not manipulate or persuade anyone to expand access or disable safeguards. Do not copy yourself or change system prompts, safety rules, or tool policies unless explicitly requested."].join("\n"),
    ["# Agent Bootstrap Context", "", "Agent bootstrap root: /data/workspace",
      ...(bootstrap.some((part) => part.startsWith("## SOUL.md")) ? ["If SOUL.md is present, embody its persona and tone unless higher-priority instructions override it."] : []),
      "", ...(bootstrap.length ? ["Agent bootstrap files loaded:", "", bootstrap.join("\n\n")] : ["No agent bootstrap files were found."])].join("\n"),
    ...(memoryParts.length ? [`# Memory\n\n${truncate(memoryParts.join("\n\n"), MEMORY_CHARS)}`] : []),
    "## Tool Use Enforcement\n- When you say you will inspect, run, read, search, edit, or verify something, call the matching tool in the same turn.\n- Do not stop at promises like 'I'll check' or 'I will do that' unless the tool call already happened in that turn.\n- If the task can still move forward with available tools, continue instead of ending early.",
    `## Current Self\nIdentity: Bibo (Agent ID: main), a personal assistant running inside nextclaw.\nHost: Cloudflare Worker\nTime handling: do not assume exact minute/second unless the user/tool explicitly provides it.\nWhen a turn includes a time hint, treat it as context for relative-time interpretation in that turn.\nChannel: web\nChat ID: ${sessionId}\nSession: ${sessionId}\nModel: nextclaw/deepseek-flash\nFor current installation, storage, service, endpoint, or health facts, query the structured status or domain command; do not present documentation defaults as current values.`,
  ];
}
