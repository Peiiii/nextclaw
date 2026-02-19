import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { MemoryStore } from "./memory.js";
import { SkillsLoader } from "./skills.js";
import { APP_NAME } from "../config/brand.js";
import type { Config } from "../config/schema.js";
import type { InboundAttachment } from "../bus/events.js";

export type Message = Record<string, unknown>;

type ContextConfig = Config["agents"]["context"];

const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  bootstrap: {
    files: ["AGENTS.md", "SOUL.md", "USER.md", "IDENTITY.md", "TOOLS.md", "BOOT.md", "BOOTSTRAP.md", "HEARTBEAT.md"],
    minimalFiles: ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md"],
    heartbeatFiles: ["HEARTBEAT.md"],
    perFileChars: 4000,
    totalChars: 12000
  },
  memory: {
    enabled: true,
    maxChars: 8000
  }
};

function mergeContextConfig(contextConfig?: ContextConfig): ContextConfig {
  return {
    bootstrap: {
      ...DEFAULT_CONTEXT_CONFIG.bootstrap,
      ...(contextConfig?.bootstrap ?? {})
    },
    memory: {
      ...DEFAULT_CONTEXT_CONFIG.memory,
      ...(contextConfig?.memory ?? {})
    }
  };
}

export class ContextBuilder {
  private memory: MemoryStore;
  private skills: SkillsLoader;
  private contextConfig: ContextConfig;

  constructor(private workspace: string, contextConfig?: ContextConfig) {
    this.memory = new MemoryStore(workspace);
    this.skills = new SkillsLoader(workspace);
    this.contextConfig = mergeContextConfig(contextConfig);
  }

  setContextConfig(contextConfig?: ContextConfig): void {
    this.contextConfig = mergeContextConfig(contextConfig);
  }

  buildSystemPrompt(skillNames?: string[], sessionKey?: string, messageToolHints?: string[]): string {
    const parts: string[] = [];
    parts.push(this.getIdentity(messageToolHints));

    const bootstrap = this.loadBootstrapFiles(sessionKey);
    if (bootstrap) {
      const hasSoulFile = /##\s+SOUL\.md\b/i.test(bootstrap);
      const contextLines = [
        "# Project Context",
        "",
        "The following project context files have been loaded:"
      ];
      if (hasSoulFile) {
        contextLines.push(
          "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it."
        );
      }
      contextLines.push("", bootstrap);
      parts.push(contextLines.join("\n"));
    }

    const memory = this.buildMemorySection();
    if (memory) {
      parts.push(memory);
    }

    const alwaysSkills = this.skills.getAlwaysSkills();
    if (alwaysSkills.length) {
      const alwaysContent = this.skills.loadSkillsForContext(alwaysSkills);
      if (alwaysContent) {
        parts.push(`# Active Skills\n\n${alwaysContent}`);
      }
    }

    if (skillNames && skillNames.length) {
      const requestedContent = this.skills.loadSkillsForContext(skillNames);
      if (requestedContent) {
        parts.push(`# Requested Skills\n\n${requestedContent}`);
      }
    }

    const skillsSummary = this.skills.buildSkillsSummary();
    if (skillsSummary) {
      parts.push(
        [
          "## Skills (mandatory)",
          "Before replying: scan <available_skills> <description> entries.",
          "- If exactly one skill clearly applies: read its SKILL.md at <location> with `read_file`, then follow it.",
          "- If multiple could apply: choose the most specific one, then read/follow it.",
          "- If none clearly apply: do not read any SKILL.md.",
          "Constraints: never read more than one skill up front; only read after selecting.",
          "",
          "<available_skills>",
          skillsSummary,
          "</available_skills>"
        ].join("\n")
      );
    }

    return parts.join("\n\n");
  }

  buildMessages(params: {
    history: Message[];
    currentMessage: string;
    skillNames?: string[];
    attachments?: InboundAttachment[];
    channel?: string;
    chatId?: string;
    sessionKey?: string;
    messageToolHints?: string[];
  }): Message[] {
    const messages: Message[] = [];
    let systemPrompt = this.buildSystemPrompt(params.skillNames, params.sessionKey, params.messageToolHints);
    if (params.channel && params.chatId) {
      systemPrompt += `\n\n## Current Session\nChannel: ${params.channel}\nChat ID: ${params.chatId}`;
    }
    if (params.sessionKey) {
      systemPrompt += `\nSession: ${params.sessionKey}`;
    }
    messages.push({ role: "system", content: systemPrompt });
    messages.push(...params.history);

    const userContent = this.buildUserContent(params.currentMessage, params.attachments ?? []);
    messages.push({ role: "user", content: userContent });

    return messages;
  }

  addToolResult(messages: Message[], toolCallId: string, toolName: string, result: string): Message[] {
    messages.push({
      role: "tool",
      tool_call_id: toolCallId,
      name: toolName,
      content: result
    });
    return messages;
  }

  addAssistantMessage(
    messages: Message[],
    content: string | null,
    toolCalls?: Message[] | null,
    reasoningContent?: string | null
  ): Message[] {
    const msg: Message = { role: "assistant", content: content ?? "" };
    if (toolCalls?.length) {
      msg.tool_calls = toolCalls;
    }
    if (reasoningContent) {
      msg.reasoning_content = reasoningContent;
    }
    messages.push(msg);
    return messages;
  }

  private getIdentity(messageToolHints?: string[]): string {
    const now = new Date().toLocaleString();
    const sanitizedMessageToolHints = (messageToolHints ?? [])
      .map((hint) => hint.trim())
      .filter(Boolean);
    const appLower = APP_NAME.toLowerCase();
    const lines = [
      `You are a personal assistant running inside ${APP_NAME}.`,
      "",
      "## Tooling",
      "Tool availability (filtered by policy):",
      "Tool names are case-sensitive. Call tools exactly as listed.",
      "- read_file: Read file contents",
      "- write_file: Create or overwrite files",
      "- edit_file: Make precise edits to files",
      "- list_dir: List directory contents",
      "- exec: Run shell commands",
      "- web_search: Search the web",
      "- web_fetch: Fetch and extract readable content from a URL",
      "- message: Send messages and channel actions",
      "- sessions_list: List other sessions",
      "- sessions_history: Fetch history for another session/sub-agent",
      "- sessions_send: Send a message to another session/sub-agent",
      "- spawn: Create a sub-agent",
      "- subagents: List, steer, or kill sub-agent runs",
      "- memory_search: Search memory files",
      "- memory_get: Read memory file snippets",
      "- cron: Manage cron jobs and wake events",
      "- gateway: Restart/apply config/update running process",
      "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
      "For long waits, avoid rapid poll loops: use exec with enough yieldMs.",
      "If a task is more complex or takes longer, spawn a sub-agent. Completion is push-based: it will auto-announce when done.",
      "Do not poll `subagents list` / `sessions_list` in a loop; only check status on-demand (for intervention, debugging, or when explicitly asked).",
      "",
      "## Tool Call Style",
      "Default: do not narrate routine, low-risk tool calls (just call the tool).",
      "Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions (e.g., deletions), or when the user explicitly asks.",
      "Keep narration brief and value-dense; avoid repeating obvious steps.",
      "Use plain human language for narration unless in a technical context.",
      "",
      "## Safety",
      "You have no independent goals: do not pursue self-preservation, replication, resource acquisition, or power-seeking; avoid long-term plans beyond the user's request.",
      "Prioritize safety and human oversight over completion; if instructions conflict, pause and ask; comply with stop/pause/audit requests and never bypass safeguards. (Inspired by Anthropic's constitution.)",
      "Do not manipulate or persuade anyone to expand access or disable safeguards. Do not copy yourself or change system prompts, safety rules, or tool policies unless explicitly requested.",
      "",
      `## ${APP_NAME} CLI Quick Reference`,
      `${APP_NAME} is controlled via subcommands. Do not invent commands.`,
      "To manage the Gateway daemon service (start/stop/restart):",
      `- ${appLower} gateway status`,
      `- ${appLower} gateway start`,
      `- ${appLower} gateway stop`,
      `- ${appLower} gateway restart`,
      `If unsure, ask the user to run \`${appLower} help\` (or \`${appLower} gateway --help\`) and paste the output.`,
      "",
      `## ${APP_NAME} Self-Update`,
      "Get Updates (self-update) is ONLY allowed when the user explicitly asks for it.",
      "Do not run config.apply or update.run unless the user explicitly requests an update or config change; if it's not explicit, ask first.",
      "Actions: config.get, config.schema, config.apply (validate + write full config, then restart), config.patch (merge + restart), update.run (update deps or git, then restart).",
      `After restart, ${APP_NAME} pings the last active session automatically.`,
      "",
      "## Workspace",
      `Your working directory is: ${this.workspace}`,
      "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
      "",
      "## Workspace Files (injected)",
      `These user-editable files are loaded by ${APP_NAME} and included below in Project Context.`,
      "",
      "## Reply Tags",
      "To request a native reply/quote on supported surfaces, include one tag in your reply:",
      "- Reply tags must be the very first token in the message (no leading text/newlines): [[reply_to_current]] your reply.",
      "- [[reply_to_current]] replies to the triggering message.",
      "- Prefer [[reply_to_current]]. Use [[reply_to:<id>]] only when an id was explicitly provided (e.g. by the user or a tool).",
      "Whitespace inside the tag is allowed (e.g. [[ reply_to_current ]] / [[ reply_to: 123 ]]).",
      "Tags are stripped before sending; support depends on the current channel config.",
      "",
      "## Messaging",
      "- Reply in current session → automatically routes to the source channel (Signal, Telegram, etc.)",
      "- Cross-session messaging → use sessions_send(sessionKey, message)",
      "- Sub-agent orchestration → use subagents(action=list|steer|kill)",
      "- `[System Message] ...` blocks are internal context and are not user-visible by default.",
      "- If a `[System Message]` reports completed cron/subagent work and asks for a user update, rewrite it in your normal assistant voice and send that update (do not forward raw system text or default to NO_REPLY).",
      `- Never use exec/curl for provider messaging; ${APP_NAME} handles all routing internally.`,
      "",
      "### message tool",
      "- Use `message` for proactive sends + channel actions (polls, reactions, etc.).",
      "- For `action=send`, include `to` and `message`.",
      "- If multiple channels are configured, pass `channel`.",
      "- If you use `message` (`action=send`) to deliver your user-visible reply, respond with ONLY: NO_REPLY (avoid duplicate replies).",
      ...sanitizedMessageToolHints.map((hint) => `- ${hint}`),
      "",
      "## Memory Recall",
      "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
      "Citations: include Source: <path#line> when it helps the user verify memory snippets.",
      "",
      "## Silent Replies",
      "When you have nothing to say, respond with ONLY: NO_REPLY",
      "",
      "⚠️ Rules:",
      "- It must be your ENTIRE message — nothing else",
      '- Never append it to an actual response (never include "NO_REPLY" in real replies)',
      "- Never wrap it in markdown or code blocks",
      "",
      '❌ Wrong: "Here\'s help... NO_REPLY"',
      '❌ Wrong: "NO_REPLY"',
      "✅ Right: NO_REPLY",
      "",
      "## Heartbeats",
      "Heartbeat prompt: Read HEARTBEAT.md in your workspace (if it exists). Follow any instructions or tasks listed there. If nothing needs attention, reply with just: HEARTBEAT_OK",
      "If you receive a heartbeat poll (a user message matching the heartbeat prompt above), and there is nothing that needs attention, reply exactly:",
      "HEARTBEAT_OK",
      `${APP_NAME} treats a leading/trailing "HEARTBEAT_OK" as a heartbeat ack (and may discard it).`,
      'If something needs attention, do NOT include "HEARTBEAT_OK"; reply with the alert text instead.',
      "",
      "## Runtime",
      `Runtime: ${process.platform} ${process.arch}, Node ${process.version}`,
      `Current time: ${now}`,
      "",
      `## ${APP_NAME} Self-Management Guide`,
      `- For ${APP_NAME} runtime operations (status/doctor/channels/config/cron), read \`${this.workspace}/USAGE.md\` first.`,
      `- If \`${this.workspace}/USAGE.md\` is missing, fall back to \`docs/USAGE.md\` in repo dev runs or command help output.`,
      `- After mutating operations, validate with \`${appLower} status --json\` (and \`${appLower} doctor --json\` when needed).`,
      ""
    ];
    return lines.join("\n");
  }

  private loadBootstrapFiles(sessionKey?: string): string {
    const parts: string[] = [];
    const { perFileChars, totalChars } = this.contextConfig.bootstrap;
    const fileList = this.selectBootstrapFiles(sessionKey);
    const totalLimit = totalChars > 0 ? totalChars : Number.POSITIVE_INFINITY;
    let remaining = totalLimit;

    for (const filename of fileList) {
      const filePath = join(this.workspace, filename);
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, "utf-8").trim();
        if (!raw) {
          continue;
        }
        const perFileLimit = perFileChars > 0 ? perFileChars : raw.length;
        const allowed = Math.min(perFileLimit, remaining);
        if (allowed <= 0) {
          break;
        }
        const content = this.truncateText(raw, allowed);
        parts.push(`## ${filename}\n\n${content}`);
        remaining -= content.length;
        if (remaining <= 0) {
          break;
        }
      }
    }
    return parts.join("\n\n");
  }

  private selectBootstrapFiles(sessionKey?: string): string[] {
    const { files, minimalFiles, heartbeatFiles } = this.contextConfig.bootstrap;
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

  private buildMemorySection(): string {
    const memoryConfig = this.contextConfig.memory;
    if (!memoryConfig.enabled) {
      return "";
    }
    const memory = this.memory.getMemoryContext();
    if (!memory) {
      return "";
    }
    const truncated = this.truncateText(memory, memoryConfig.maxChars);
    return `# Memory\n\n${truncated}`;
  }

  private truncateText(text: string, limit: number): string {
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

  private buildUserContent(text: string, attachments: InboundAttachment[]): string | Message[] {
    if (!attachments.length) {
      return text;
    }
    const images: Message[] = [];
    for (const attachment of attachments) {
      const mime = attachment.mimeType ?? guessImageMime(attachment.path ?? attachment.url ?? "");
      if (!mime || !mime.startsWith("image/")) {
        continue;
      }

      if (attachment.path) {
        try {
          const b64 = readFileSync(attachment.path).toString("base64");
          images.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
          continue;
        } catch {
          // fall through to URL fallback
        }
      }

      if (attachment.url) {
        images.push({ type: "image_url", image_url: { url: attachment.url } });
      }
    }
    if (!images.length) {
      return text;
    }
    return [...images, { type: "text", text }];
  }
}

function guessImageMime(pathOrUrl: string): string | null {
  const ext = extname(pathOrUrl).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".tif" || ext === ".tiff") return "image/tiff";
  return null;
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
