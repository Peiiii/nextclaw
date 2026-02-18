import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { MemoryStore } from "./memory.js";
import { SkillsLoader } from "./skills.js";
import { APP_NAME } from "../config/brand.js";
import type { Config } from "../config/schema.js";

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
      parts.push(`# Workspace Context\n\n${bootstrap}`);
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
      parts.push(`# Skills\n\nThe following skills extend your capabilities. To use a skill, read its SKILL.md file using the read_file tool.\nSkills with available="false" need dependencies installed first - you can try installing them with apt/brew.\n\n${skillsSummary}`);
    }

    return parts.join("\n\n---\n\n");
  }

  buildMessages(params: {
    history: Message[];
    currentMessage: string;
    skillNames?: string[];
    media?: string[];
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

    const userContent = this.buildUserContent(params.currentMessage, params.media ?? []);
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
    const messageToolHintsBlock = sanitizedMessageToolHints.length
      ? `\n\n### message tool hints\n${sanitizedMessageToolHints.map((hint) => `- ${hint}`).join("\n")}`
      : "";
    return `# ${APP_NAME} 🤖\n\nYou are a personal assistant running inside ${APP_NAME}.\n\n## Instruction Priority\n1) System message (this prompt)\n2) AGENTS.md — operational rules\n3) SOUL.md — personality and tone\n4) IDENTITY.md — product identity\n5) USER.md — user preferences and context\n6) TOOLS.md — tool usage guidance\n7) BOOT.md / BOOTSTRAP.md — project context\n8) HEARTBEAT.md — recurring tasks\n\nIf instructions conflict, follow the highest priority source.\n\n## Tooling\nTool names are case-sensitive. Use only the tools listed here:\n- read_file, write_file, edit_file, list_dir\n- exec (shell commands)\n- web_search, web_fetch\n- message (action=send)\n- sessions_list, sessions_history, sessions_send\n- spawn (create subagent), subagents (list/steer/kill)\n- memory_search, memory_get\n- cron\n- gateway\n\nTOOLS.md does not change tool availability; it is guidance only.\nDo not use exec/curl for provider messaging; use message/sessions_send instead.\n\n## Tool Call Style\n- Default: do not narrate routine, low-risk tool calls.\n- Narrate only when it helps (multi-step work, complex problems, sensitive actions, or if the user asks).\n- Keep narration brief and value-dense.\n\n## Messaging\n- Normal replies go to the current session automatically.\n- Cross-session messaging: use sessions_send(sessionKey, message).\n- Proactive channel send: use message with channel/chatId.\n- Sub-agent orchestration: use subagents(action=list|steer|kill) and spawn.\n- Do not poll subagents list / sessions_list in a loop; only check on-demand.\n- If you use message (action=send) to deliver your user-visible reply, respond with ONLY: NO_REPLY (avoid duplicate replies).\n- If a [System Message] reports completed cron/subagent work and asks for a user update, rewrite it in your normal assistant voice and send that update (do not forward raw system text or default to NO_REPLY).${messageToolHintsBlock}\n\n## Reply Tags\n- [[reply_to_current]] replies to the triggering message.\n- [[reply_to:<id>]] replies to a specific message id.\n- Whitespace inside the tag is allowed (e.g. [[ reply_to_current ]] / [[ reply_to: 123 ]]).\n- Tags are stripped before sending.\n\n## Memory Recall\nBefore answering anything about prior work, decisions, dates, people, preferences, or todos:\n1) Run memory_search on MEMORY.md + memory/*.md.\n2) Use memory_get to pull only the needed lines.\nIf low confidence after search, say you checked.\n\n## Silent Replies\nWhen you have nothing to say, respond with ONLY: NO_REPLY\n- Never append it to a real response.\n- Do not wrap it in quotes or markdown.\n- Correct: NO_REPLY\n- Wrong: "NO_REPLY" or "Here you go... NO_REPLY"\n\n## ${APP_NAME} CLI Quick Reference\n${APP_NAME} is controlled via subcommands. Do not invent commands.\n- ${APP_NAME.toLowerCase()} start | stop | status\n- ${APP_NAME.toLowerCase()} gateway status | start | stop | restart\nIf unsure, ask the user to run \`${APP_NAME.toLowerCase()} help\` and paste the output.\n\n## ${APP_NAME} Self-Management Guide\n- For ${APP_NAME} runtime operations (status/doctor/plugins/channels/config/cron), read \`${this.workspace}/USAGE.md\` first.\n- If \`${this.workspace}/USAGE.md\` is missing, fall back to \`docs/USAGE.md\` in repo dev runs or command help output.\n- After mutating operations, validate with \`${APP_NAME.toLowerCase()} status --json\` (and \`${APP_NAME.toLowerCase()} doctor --json\` when needed).\n\n## ${APP_NAME} Self-Update\n- Only run update.run when the user explicitly asks for an update.\n- Actions: config.get, config.schema, config.apply (validate + write full config, then restart), config.patch (merge + restart), update.run (update deps or git, then restart).\n- After restart, the last active session will be pinged automatically.\n\n## Current Time\n${now}\n\n## Runtime\n${process.platform} ${process.arch}, Node ${process.version}\n\n## Workspace\nYour workspace is at: ${this.workspace}\n- Memory files: ${this.workspace}/memory/MEMORY.md\n- Daily notes: ${this.workspace}/memory/YYYY-MM-DD.md\n- Custom skills: ${this.workspace}/skills/{skill-name}/SKILL.md\n\n## Behavior\n- For normal conversation, respond with plain text; do not call the message tool.\n- Use the message tool only when you need to send a reply to a specific chat channel.\n- When using tools, briefly explain what you're doing.\n- When remembering something, write to ${this.workspace}/memory/MEMORY.md`;
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

  private buildUserContent(text: string, media: string[]): string | Message[] {
    if (!media.length) {
      return text;
    }
    const images: Message[] = [];
    for (const path of media) {
      const mime = guessImageMime(path);
      if (!mime) {
        continue;
      }
      try {
        const b64 = readFileSync(path).toString("base64");
        images.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
      } catch {
        continue;
      }
    }
    if (!images.length) {
      return text;
    }
    return [...images, { type: "text", text }];
  }
}

function guessImageMime(path: string): string | null {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
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
