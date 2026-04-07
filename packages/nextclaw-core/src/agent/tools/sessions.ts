import { Tool } from "./base.js";
import type { SessionManager } from "../../session/manager.js";
import {
  normalizeOptionalRouteString,
  parseAgentSessionDeliveryRoute,
  parseSimpleSessionKey,
  resolveSessionDeliveryRoute,
} from "../route-resolver.js";

const DEFAULT_LIMIT = 20;
const DEFAULT_MESSAGE_LIMIT = 0;
const MAX_MESSAGE_LIMIT = 20;
const HISTORY_MAX_BYTES = 80 * 1024;
const HISTORY_TEXT_MAX_CHARS = 4000;

const toInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
};

const stringsEqual = (left: unknown, right: unknown): boolean => {
  const normalizedLeft = normalizeOptionalRouteString(left);
  const normalizedRight = normalizeOptionalRouteString(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return normalizedLeft === normalizedRight;
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

const normalizeHistoryContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }
  if (content == null) {
    return "";
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
};

const sanitizeHistoryMessage = (msg: { role: string; content: unknown; timestamp: string }) => {
  const entry = { ...msg, content: normalizeHistoryContent(msg.content) };
  const res = truncateHistoryText(entry.content);
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
    return "List available sessions with timestamps and optional route filters";
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
        sessionKey: {
          type: "string",
          description: "Only include the exact session key"
        },
        channel: {
          type: "string",
          description: "Only include sessions whose resolved delivery channel matches"
        },
        to: {
          type: "string",
          description: "Only include sessions whose resolved delivery target/chatId matches"
        },
        accountId: {
          type: "string",
          description: "Only include sessions whose resolved delivery accountId matches"
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
    const sessionKeyFilter = normalizeOptionalRouteString(params.sessionKey);
    const channelFilter = normalizeOptionalRouteString(params.channel)?.toLowerCase();
    const toFilter = normalizeOptionalRouteString(params.to);
    const accountIdFilter = normalizeOptionalRouteString(params.accountId);
    const activeMinutes = toInt(params.activeMinutes, 0);
    const messageLimit = Math.min(toInt(params.messageLimit, DEFAULT_MESSAGE_LIMIT), MAX_MESSAGE_LIMIT);
    const now = Date.now();
    const sessions = this.sessions
      .listSessions()
      .sort((a, b) => (toTimestamp(b.updated_at) ?? 0) - (toTimestamp(a.updated_at) ?? 0))
      .filter((entry) => {
        const key = typeof entry.key === "string" ? entry.key : "";
        const session = this.sessions.getIfExists(key);
        const parsed = parseSimpleSessionKey(key);
        const resolvedRoute =
          resolveSessionDeliveryRoute(session) ??
          parseAgentSessionDeliveryRoute(key) ??
          (parsed && parsed.channel !== "agent" ? { channel: parsed.channel, chatId: parsed.chatId } : null);
        if (sessionKeyFilter && key !== sessionKeyFilter) {
          return false;
        }
        if (channelFilter && resolvedRoute?.channel?.toLowerCase() !== channelFilter) {
          return false;
        }
        if (toFilter && !stringsEqual(resolvedRoute?.chatId, toFilter)) {
          return false;
        }
        if (accountIdFilter && !stringsEqual(resolvedRoute?.accountId, accountIdFilter)) {
          return false;
        }
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
        const parsed = parseSimpleSessionKey(key);
        const session = this.sessions.getIfExists(key);
        const resolvedRoute =
          resolveSessionDeliveryRoute(session) ??
          parseAgentSessionDeliveryRoute(key) ??
          (parsed && parsed.channel !== "agent" ? { channel: parsed.channel, chatId: parsed.chatId } : null);
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
          channel: resolvedRoute?.channel ?? parsed?.channel,
          label,
          displayName,
          deliveryContext,
          updatedAt,
          createdAt,
          sessionId: key,
          lastChannel:
            typeof metadata.last_channel === "string"
              ? metadata.last_channel
              : resolvedRoute?.channel ?? parsed?.channel ?? undefined,
          lastTo:
            typeof metadata.last_to === "string"
              ? metadata.last_to
              : resolvedRoute?.chatId ?? parsed?.chatId ?? undefined,
          lastAccountId:
            typeof metadata.last_account_id === "string"
              ? metadata.last_account_id
              : resolvedRoute?.accountId ?? undefined,
          transcriptPath: entry.path
        };
        if (messageLimit > 0) {
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
