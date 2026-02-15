import crypto from "node:crypto";
import { Tool } from "./base.js";
import type { SessionManager } from "../../session/manager.js";
import type { MessageBus } from "../../bus/queue.js";
import type { OutboundMessage } from "../../bus/events.js";

const DEFAULT_LIMIT = 20;
const DEFAULT_MESSAGE_LIMIT = 0;
const MAX_MESSAGE_LIMIT = 20;
const HISTORY_MAX_BYTES = 80 * 1024;
const HISTORY_TEXT_MAX_CHARS = 4000;

const toInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
};

const parseSessionKey = (key: string): { channel: string; chatId: string } | null => {
  const trimmed = key.trim();
  if (!trimmed.includes(":")) {
    return null;
  }
  const [channel, chatId] = trimmed.split(":", 2);
  if (!channel || !chatId) {
    return null;
  }
  return { channel, chatId };
};

const classifySessionKind = (key: string): string => {
  if (key.startsWith("cron:") || key === "heartbeat") {
    return "cron";
  }
  if (key.startsWith("hook:")) {
    return "hook";
  }
  if (key.startsWith("subagent:") || key.startsWith("node:")) {
    return "node";
  }
  if (key.startsWith("system:")) {
    return "other";
  }
  return "main";
};

const truncateHistoryText = (text: string): { text: string; truncated: boolean } => {
  if (text.length <= HISTORY_TEXT_MAX_CHARS) {
    return { text, truncated: false };
  }
  return { text: `${text.slice(0, HISTORY_TEXT_MAX_CHARS)}\n…(truncated)…`, truncated: true };
};

const sanitizeHistoryMessage = (msg: { role: string; content: string; timestamp: string }) => {
  const entry = { ...msg };
  const res = truncateHistoryText(entry.content ?? "");
  return { message: { ...entry, content: res.text }, truncated: res.truncated };
};

const jsonBytes = (value: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Buffer.byteLength(String(value), "utf8");
  }
};

const enforceHistoryHardCap = (items: unknown[]): unknown[] => {
  const bytes = jsonBytes(items);
  if (bytes <= HISTORY_MAX_BYTES) {
    return items;
  }
  const last = items.at(-1);
  if (last && jsonBytes([last]) <= HISTORY_MAX_BYTES) {
    return [last];
  }
  return [{ role: "assistant", content: "[sessions_history omitted: message too large]" }];
};

const toTimestamp = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

export class SessionsListTool extends Tool {
  constructor(private sessions: SessionManager) {
    super();
  }

  get name(): string {
    return "sessions_list";
  }

  get description(): string {
    return "List available sessions with timestamps";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        kinds: {
          type: "array",
          items: { type: "string" },
          description: "Filter by session kinds (main/group/cron/hook/other)"
        },
        limit: { type: "integer", minimum: 1, description: "Maximum number of sessions to return" },
        activeMinutes: { type: "integer", minimum: 1, description: "Only include active sessions" },
        messageLimit: { type: "integer", minimum: 0, description: "Include last N messages (max 20)" }
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const limit = toInt(params.limit, DEFAULT_LIMIT);
    const rawKinds = Array.isArray(params.kinds) ? params.kinds.map((k) => String(k).toLowerCase()) : [];
    const kinds = rawKinds.length ? new Set(rawKinds) : null;
    const activeMinutes = toInt(params.activeMinutes, 0);
    const messageLimit = Math.min(toInt(params.messageLimit, DEFAULT_MESSAGE_LIMIT), MAX_MESSAGE_LIMIT);
    const now = Date.now();
    const sessions = this.sessions
      .listSessions()
      .sort((a, b) => (toTimestamp(b.updated_at) ?? 0) - (toTimestamp(a.updated_at) ?? 0))
      .filter((entry) => {
        if (activeMinutes > 0 && entry.updated_at) {
          const updated = Date.parse(String(entry.updated_at));
          if (Number.isFinite(updated) && now - updated > activeMinutes * 60 * 1000) {
            return false;
          }
        }
        if (kinds) {
          const kind = classifySessionKind(String(entry.key ?? ""));
          if (!kinds.has(kind)) {
            return false;
          }
        }
        return true;
      })
      .slice(0, limit)
      .map((entry) => {
        const key = String(entry.key ?? "");
        const kind = classifySessionKind(key);
        const parsed = parseSessionKey(key);
        const metadata = (entry.metadata as Record<string, unknown> | undefined) ?? {};
        const label =
          typeof metadata.label === "string"
            ? metadata.label
            : typeof metadata.session_label === "string"
              ? metadata.session_label
              : undefined;
        const displayName =
          typeof metadata.displayName === "string"
            ? metadata.displayName
            : typeof metadata.display_name === "string"
              ? metadata.display_name
              : undefined;
        const deliveryContext =
          metadata.deliveryContext && typeof metadata.deliveryContext === "object"
            ? (metadata.deliveryContext as Record<string, unknown>)
            : undefined;
        const updatedAt = toTimestamp(entry.updated_at);
        const createdAt = toTimestamp(entry.created_at);
        const base: Record<string, unknown> = {
          key,
          kind,
          channel: parsed?.channel,
          label,
          displayName,
          deliveryContext,
          updatedAt,
          createdAt,
          sessionId: key,
          lastChannel:
            typeof metadata.last_channel === "string"
              ? metadata.last_channel
              : parsed?.channel ?? undefined,
          lastTo:
            typeof metadata.last_to === "string" ? metadata.last_to : parsed?.chatId ?? undefined,
          lastAccountId: typeof metadata.last_account_id === "string" ? metadata.last_account_id : undefined,
          transcriptPath: entry.path
        };
        if (messageLimit > 0) {
          const session = this.sessions.getIfExists(key);
          if (session) {
            const filtered = session.messages.filter((msg) => msg.role !== "tool");
            const recent = filtered.slice(-messageLimit).map((msg) => ({
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp
            }));
            const sanitized = recent.map((msg) => sanitizeHistoryMessage(msg).message);
            base.messages = sanitized;
          }
        }
        return base;
      });
    return JSON.stringify({ sessions }, null, 2);
  }
}

export class SessionsHistoryTool extends Tool {
  constructor(private sessions: SessionManager) {
    super();
  }

  get name(): string {
    return "sessions_history";
  }

  get description(): string {
    return "Fetch recent messages from a session";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        sessionKey: { type: "string", description: "Session key in the format channel:chatId" },
        limit: { type: "integer", minimum: 1, description: "Maximum number of messages to return" },
        includeTools: { type: "boolean", description: "Include tool messages" }
      },
      required: ["sessionKey"]
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const sessionKey = String(params.sessionKey ?? "").trim();
    if (!sessionKey) {
      return "Error: sessionKey is required";
    }
    let session = this.sessions.getIfExists(sessionKey);
    if (!session) {
      const candidates = this.sessions.listSessions();
      const match = candidates.find((entry) => {
        const key = typeof entry.key === "string" ? entry.key : "";
        if (key === sessionKey || key.endsWith(`:${sessionKey}`)) {
          return true;
        }
        const meta = entry.metadata as Record<string, unknown> | undefined;
        const metaLabel = meta?.label ?? meta?.session_label;
        return typeof metaLabel === "string" && metaLabel.trim() === sessionKey;
      });
      const resolvedKey = match && typeof match.key === "string" ? match.key : "";
      if (resolvedKey) {
        session = this.sessions.getIfExists(resolvedKey);
      }
    }
    if (!session) {
      return `Error: session '${sessionKey}' not found`;
    }
    const limit = toInt(params.limit, DEFAULT_LIMIT);
    const includeTools = typeof params.includeTools === "boolean" ? params.includeTools : false;
    const filtered = includeTools ? session.messages : session.messages.filter((msg) => msg.role !== "tool");
    const recent = filtered.slice(-limit).map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));
    const sanitized = recent.map((msg) => sanitizeHistoryMessage(msg).message);
    const capped = enforceHistoryHardCap(sanitized);
    return JSON.stringify({ sessionKey, messages: capped }, null, 2);
  }
}

export class SessionsSendTool extends Tool {
  constructor(
    private sessions: SessionManager,
    private bus: MessageBus
  ) {
    super();
  }

  get name(): string {
    return "sessions_send";
  }

  get description(): string {
    return "Send a message to another session (cross-channel delivery)";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        sessionKey: { type: "string", description: "Target session key in the format channel:chatId" },
        label: { type: "string", description: "Session label (if sessionKey not provided)" },
        agentId: { type: "string", description: "Optional agent id (unused in local runtime)" },
        message: { type: "string", description: "Message content to send" },
        timeoutSeconds: { type: "number", description: "Optional timeout in seconds" },
        content: { type: "string", description: "Alias for message" },
        replyTo: { type: "string", description: "Message ID to reply to" },
        silent: { type: "boolean", description: "Send without notification where supported" }
      },
      required: []
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const runId = crypto.randomUUID();
    const sessionKeyParam = String(params.sessionKey ?? "").trim();
    const labelParam = String(params.label ?? "").trim();
    if (sessionKeyParam && labelParam) {
      return JSON.stringify(
        { runId, status: "error", error: "Provide either sessionKey or label (not both)" },
        null,
        2
      );
    }
    let sessionKey = sessionKeyParam;
    const message = String(params.message ?? params.content ?? "");
    if (!message) {
      return JSON.stringify({ runId, status: "error", error: "message is required" }, null, 2);
    }
    if (!sessionKey) {
      const label = labelParam;
      if (!label) {
        return JSON.stringify({ runId, status: "error", error: "sessionKey or label is required" }, null, 2);
      }
      const candidates = this.sessions.listSessions();
      const match = candidates.find((entry) => {
        const key = typeof entry.key === "string" ? entry.key : "";
        if (key === label || key.endsWith(`:${label}`)) {
          return true;
        }
        const meta = entry.metadata as Record<string, unknown> | undefined;
        const metaLabel = meta?.label ?? meta?.session_label;
        return typeof metaLabel === "string" && metaLabel.trim() === label;
      });
      sessionKey = match && typeof match.key === "string" ? match.key : "";
      if (!sessionKey) {
        return JSON.stringify(
          { runId, status: "error", error: `no session found for label '${label}'` },
          null,
          2
        );
      }
    }
    const parsed = parseSessionKey(sessionKey);
    if (!parsed) {
      return JSON.stringify(
        { runId, status: "error", error: "sessionKey must be in the format channel:chatId" },
        null,
        2
      );
    }
    const replyTo = params.replyTo ? String(params.replyTo) : undefined;
    const silent = typeof params.silent === "boolean" ? params.silent : undefined;
    const outbound: OutboundMessage = {
      channel: parsed.channel,
      chatId: parsed.chatId,
      content: message,
      replyTo,
      media: [],
      metadata: silent !== undefined ? { silent } : {}
    };
    await this.bus.publishOutbound(outbound);

    const session = this.sessions.getOrCreate(sessionKey);
    this.sessions.addMessage(session, "assistant", message, { via: "sessions_send" });
    this.sessions.save(session);

    return JSON.stringify(
      { runId, status: "ok", sessionKey: `${parsed.channel}:${parsed.chatId}` },
      null,
      2
    );
  }
}
