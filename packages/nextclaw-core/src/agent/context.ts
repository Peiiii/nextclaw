import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { MemoryStore } from "./memory/memory-store.js";
import {
  buildWorkspaceProjectContextSection,
  DEFAULT_BOOTSTRAP_CONTEXT_CONFIG,
} from "../runtime-context/bootstrap-context.js";
import {
  buildActiveSkillsSystemSection,
  buildAvailableSkillsSystemSection,
  buildRequestedSkillsSystemSection
} from "./skill-context.js";
import { SkillsLoader } from "./skills.js";
import { DEFAULT_TOOL_CATALOG, normalizeToolCatalogEntries, type ToolCatalogEntry } from "./tool-catalog.utils.js";
import { APP_NAME } from "../config/brand.js";
import type { Config } from "../config/schema.js";
import type { InboundAttachment } from "../bus/events.js";
import { SILENT_REPLY_TOKEN } from "./tokens.js";
import type { ThinkingLevel } from "../utils/thinking.js";
import {
  SessionProjectContextResolver,
  type SessionProjectContext,
} from "../session/session-project-context.js";

export type Message = Record<string, unknown>;

type ContextConfig = Config["agents"]["context"];
type ContextBuilderOptions = {
  hostWorkspace?: string;
  sessionProjectRoot?: string | null;
};

const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  bootstrap: {
    ...DEFAULT_BOOTSTRAP_CONTEXT_CONFIG,
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
  private readonly projectContext: SessionProjectContext;
  private readonly projectContextResolver = new SessionProjectContextResolver();

  constructor(
    private workspace: string,
    contextConfig?: ContextConfig,
    options: ContextBuilderOptions = {},
  ) {
    const sessionMetadata = options.sessionProjectRoot
      ? { project_root: options.sessionProjectRoot }
      : null;
    this.projectContext = this.projectContextResolver.resolve({
      sessionMetadata,
      workspace: options.hostWorkspace ?? workspace,
      defaultWorkspace: workspace,
    });
    this.memory = new MemoryStore(this.projectContext.hostWorkspace);
    this.skills = new SkillsLoader({
      workspace: this.projectContext.hostWorkspace,
      projectRoot: this.projectContext.projectRoot,
    });
    this.contextConfig = mergeContextConfig(contextConfig);
  }

  setContextConfig = (contextConfig?: ContextConfig): void => {
    this.contextConfig = mergeContextConfig(contextConfig);
  };

  buildSystemPrompt = (
    skillNames?: string[],
    sessionKey?: string,
    messageToolHints?: string[],
    availableTools?: ToolCatalogEntry[],
    additionalSystemSections?: string[],
  ): string => {
    const parts: string[] = [];
    parts.push(this.getIdentity(messageToolHints, availableTools));

    if (skillNames && skillNames.length) {
      const requestedSection = buildRequestedSkillsSystemSection(this.skills, skillNames);
      if (requestedSection) {
        parts.push(requestedSection);
      }
    }

    const projectContextSection = buildWorkspaceProjectContextSection({
      projectContext: this.projectContext,
      contextConfig: this.contextConfig,
      sessionKey,
    });
    if (projectContextSection) {
      parts.push(projectContextSection);
    }

    const memory = this.buildMemorySection();
    if (memory) {
      parts.push(memory);
    }

    const alwaysSkills = this.skills.getAlwaysSkills();
    if (alwaysSkills.length) {
      const activeSection = buildActiveSkillsSystemSection(this.skills, alwaysSkills);
      if (activeSection) {
        parts.push(activeSection);
      }
    }

    const availableSkillsSection = buildAvailableSkillsSystemSection(this.skills);
    if (availableSkillsSection) {
      parts.push(availableSkillsSection);
    }

    for (const section of additionalSystemSections ?? []) {
      const trimmed = section.trim();
      if (trimmed) parts.push(trimmed);
    }

    return parts.join("\n\n");
  };

  buildMessages = (params: {
    history: Message[];
    currentMessage: string;
    skillNames?: string[];
    attachments?: InboundAttachment[];
    channel?: string;
    chatId?: string;
    sessionKey?: string;
    thinkingLevel?: ThinkingLevel | null;
    messageToolHints?: string[];
    availableTools?: ToolCatalogEntry[];
    additionalSystemSections?: string[];
  }): Message[] => {
    const messages: Message[] = [];
    let systemPrompt = this.buildSystemPrompt(params.skillNames, params.sessionKey, params.messageToolHints, params.availableTools, params.additionalSystemSections);
    if (params.channel && params.chatId) {
      systemPrompt += `\n\n## Current Session\nChannel: ${params.channel}\nChat ID: ${params.chatId}`;
    }
    if (params.sessionKey) {
      systemPrompt += `\nSession: ${params.sessionKey}`;
    }
    if (params.thinkingLevel) {
      systemPrompt += `\nThinking policy: ${params.thinkingLevel}`;
    }
    messages.push({ role: "system", content: systemPrompt });
    messages.push(...params.history);

    const userContent = this.buildUserContent(params.currentMessage, params.attachments ?? []);
    messages.push({ role: "user", content: userContent });

    return messages;
  };

  addToolResult = (messages: Message[], toolCallId: string, toolName: string, result: string): Message[] => {
    messages.push({
      role: "tool",
      tool_call_id: toolCallId,
      name: toolName,
      content: result
    });
    return messages;
  };

  addAssistantMessage = (
    messages: Message[],
    content: string | null,
    toolCalls?: Message[] | null,
    reasoningContent?: string | null
  ): Message[] => {
    const msg: Message = { role: "assistant", content: content ?? "" };
    if (toolCalls?.length) {
      msg.tool_calls = toolCalls;
    }
    if (reasoningContent) {
      msg.reasoning_content = reasoningContent;
    }
    messages.push(msg);
    return messages;
  };

  private getIdentity = (messageToolHints?: string[], availableTools?: ToolCatalogEntry[]): string => {
    const sanitizedMessageToolHints = (messageToolHints ?? [])
      .map((hint) => hint.trim())
      .filter(Boolean);
    const toolCatalog = availableTools ? normalizeToolCatalogEntries(availableTools) : [...DEFAULT_TOOL_CATALOG];
    const appLower = APP_NAME.toLowerCase();
    const lines = [
      `You are a personal assistant running inside ${APP_NAME}.`,
      "",
      "## Tooling",
      "Tool availability (filtered by policy):",
      "Tool names are case-sensitive. Call tools exactly as listed.",
      "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
      "For long waits, avoid rapid poll loops: use exec with enough yieldMs.",
      "For relative time/date scheduling requests (for example 'in 5 minutes' / '1分钟后'), first check the current local time with an available tool such as exec/date, then convert it to an absolute ISO time with timezone. Do not guess.",
      "If a task is more complex or takes longer, spawn a sub-agent. Completion is push-based: it will auto-announce when done.",
      "Do not poll `subagents list` / `sessions_list` in a loop; only check status on-demand (for intervention, debugging, or when explicitly asked).",
      "",
      "## Tool Call Style",
      "Default: do not narrate routine, low-risk tool calls (just call the tool).",
      "Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions (e.g., deletions), or when the user explicitly asks.",
      "Keep narration brief and value-dense; avoid repeating obvious steps.",
      "Use plain human language for narration unless in a technical context.",
      "",
      "## Chat Composer Tokens",
      "When a user message contains tokens like `$weather` or `$web-search`, treat each `$<skill-spec>` token as a user-visible marker that the corresponding skill was explicitly selected in the chat composer.",
      "These tokens can appear inline with normal prose. Do not ignore them or reinterpret them as shell variables or currency unless the surrounding context clearly says otherwise.",
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
      "When patching config, copy enum values exactly from config.schema; never invent new variants.",
      "session.dmScope legal values are exactly: main | per-peer | per-channel-peer | per-account-channel-peer.",
      "If an enum/path is uncertain, stop and call config.schema first; do not guess.",
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
      "- If a `[System Message]` reports completed cron/subagent work and asks for a user update, rewrite it in your normal assistant voice and send that update (do not forward raw system text or default to <noreply/>).",
      `- Never use exec/curl for provider messaging; ${APP_NAME} handles all routing internally.`,
      "",
      "### message tool",
      "- Use `message` for proactive sends + channel actions (polls, reactions, etc.).",
      "- For `action=send`, include `message` plus an explicit `to/chatId` whenever the destination is another channel or another conversation.",
      "- Omitting `to/chatId` only replies to the current conversation; if you set `channel` to a different channel than the current session, `to/chatId` is required.",
      "- If multiple channels are configured, pass `channel`.",
      "- If you use `message` (`action=send`) to deliver your user-visible reply, respond with ONLY two blank lines + <noreply/> (avoid duplicate replies).",
      ...sanitizedMessageToolHints.map((hint) => `- ${hint}`),
      "",
      "## Memory Recall",
      "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
      "Citations: include Source: <path#line> when it helps the user verify memory snippets.",
      "",
      "## Silent Replies",
      `Silent marker token: ${SILENT_REPLY_TOKEN}`,
      "When you have nothing to say, respond with EXACTLY two blank lines followed by <noreply/>",
      "",
      "⚠️ Rules:",
      "- It must be your ENTIRE message — nothing else",
      '- If <noreply/> appears anywhere, the system will stop reply/output and subsequent processing',
      "- Never wrap it in markdown or code blocks",
      "",
      '❌ Wrong: "Here\'s help... <noreply/>"',
      '❌ Wrong: "<noreply/>"',
      '✅ Right: "\\n\\n<noreply/>"',
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
      "Time handling: do not assume exact minute/second unless the user/tool explicitly provides it.",
      "When a turn includes a time hint, treat it as context for relative-time interpretation in that turn.",
      "",
      `## ${APP_NAME} Self-Management Guide`,
      `- For ${APP_NAME} self-management operations (version/status/doctor/service/plugins/channels/config/agents/cron/remote/update), read \`${this.workspace}/USAGE.md\` first.`,
      "- Treat these product-management intents as higher priority than generic skills with overlapping words such as create/install/publish.",
      "- Do not load unrelated generic skills before reading USAGE.md for a self-management intent.",
      "- If you notice historical copied built-in skills under the workspace skills directory, treat them as deprecated artifacts; the built-in package definition is the source of truth.",
      `- If \`${this.workspace}/USAGE.md\` is missing, fall back to \`docs/USAGE.md\` in repo dev runs or command help output.`,
      `- For version lookup, use \`${appLower} --version\` exactly; do not infer version from status output.`,
      `- After mutating operations, validate with \`${appLower} status --json\` (and \`${appLower} doctor --json\` when needed).`,
      ""
    ];
    const toolLines =
      toolCatalog.length > 0
        ? toolCatalog.map((tool) => `- ${tool.name}: ${tool.description ?? "No description available"}`)
        : ["- No tools available for this turn."];
    lines.splice(5, 0, ...toolLines);
    return lines.join("\n");
  };

  private buildMemorySection = (): string => {
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
  };

  private truncateText = (text: string, limit: number): string => {
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
  };

  private buildUserContent = (text: string, attachments: InboundAttachment[]): string | Message[] => {
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
  };
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
