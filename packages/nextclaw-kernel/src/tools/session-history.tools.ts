import { normalizeToolParams } from "@nextclaw/core";
import type { NcpMessage, NcpSessionSummary, NcpTool } from "@nextclaw/ncp";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";

const DEFAULT_LIMIT = 20;
const MAX_MESSAGE_LIMIT = 20;
const HISTORY_MAX_BYTES = 80 * 1024;
const HISTORY_TEXT_MAX_CHARS = 4000;

function toInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function messageText(message: NcpMessage): string {
  const text = message.parts
    .map((part) => (part.type === "text" || part.type === "rich-text" || part.type === "reasoning" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
  if (text) return text;
  return JSON.stringify(message.parts, null, 2);
}

function sanitizeMessage(message: NcpMessage) {
  const content = messageText(message);
  const truncated = content.length > HISTORY_TEXT_MAX_CHARS;
  return {
    role: message.role,
    content: truncated ? `${content.slice(0, HISTORY_TEXT_MAX_CHARS)}\n...(truncated)...` : content,
    timestamp: message.timestamp,
    ...(truncated ? { truncated: true } : {}),
  };
}

function capHistory(items: unknown[]): unknown[] {
  const text = JSON.stringify(items);
  if (Buffer.byteLength(text, "utf8") <= HISTORY_MAX_BYTES) return items;
  const last = items.at(-1);
  return last && Buffer.byteLength(JSON.stringify([last]), "utf8") <= HISTORY_MAX_BYTES
    ? [last]
    : [{ role: "assistant", content: "[sessions_history omitted: message too large]" }];
}

function sessionLabel(summary: NcpSessionSummary): string | undefined {
  return readString(summary.metadata?.label) ?? readString(summary.metadata?.session_label);
}

export class SessionsListTool implements NcpTool {
  readonly name = "sessions_list";
  readonly description = "List available sessions with timestamps.";
  readonly parameters = {
    type: "object",
    properties: {
      sessionKey: { type: "string", description: "Only include the exact session key" },
      limit: { type: "integer", minimum: 1, description: "Maximum number of sessions to return" },
      messageLimit: { type: "integer", minimum: 0, description: "Include last N messages (max 20)" },
    },
  };

  constructor(private readonly sessions: NcpSessionManager) {}

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const { limit, messageLimit, sessionKey } = params;
    const exactSessionKey = readString(sessionKey);
    const summaries = exactSessionKey
      ? [await this.sessions.getSession(exactSessionKey)].filter((summary): summary is NcpSessionSummary => Boolean(summary))
      : await this.sessions.listSessions();
    const maxSessions = toInt(limit, DEFAULT_LIMIT);
    const maxMessages = Math.min(toInt(messageLimit, 0), MAX_MESSAGE_LIMIT);
    const result: Record<string, unknown>[] = [];

    for (const summary of summaries) {
      const entry: Record<string, unknown> = {
        key: summary.sessionId,
        sessionId: summary.sessionId,
        agentId: summary.agentId,
        label: sessionLabel(summary),
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        status: summary.status,
      };
      if (maxMessages > 0) {
        entry.messages = (await this.sessions.listSessionMessages(summary.sessionId))
          .filter((message) => message.role !== "tool")
          .slice(-maxMessages)
          .map(sanitizeMessage);
      }
      result.push(entry);
      if (result.length >= maxSessions) break;
    }
    return JSON.stringify({ sessions: result }, null, 2);
  };
}

export class SessionsHistoryTool implements NcpTool {
  readonly name = "sessions_history";
  readonly description = "Fetch recent messages from a session";
  readonly parameters = {
    type: "object",
    properties: {
      sessionKey: { type: "string", description: "Session id" },
      limit: { type: "integer", minimum: 1, description: "Maximum number of messages to return" },
      includeTools: { type: "boolean", description: "Include tool messages" },
    },
    required: ["sessionKey"],
  };

  constructor(private readonly sessions: NcpSessionManager) {}

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const { includeTools, limit, sessionKey: rawSessionKey } = params;
    const sessionKey = readString(rawSessionKey);
    if (!sessionKey) return "Error: sessionKey is required";
    const session = await this.resolveSession(sessionKey);
    if (!session) return `Error: session '${sessionKey}' not found`;
    const messages = await this.sessions.listSessionMessages(session.sessionId);
    const filtered = includeTools === true ? messages : messages.filter((message) => message.role !== "tool");
    return JSON.stringify({
      sessionKey: session.sessionId,
      messages: capHistory(filtered.slice(-toInt(limit, DEFAULT_LIMIT)).map(sanitizeMessage)),
    }, null, 2);
  };

  private resolveSession = async (sessionKey: string): Promise<NcpSessionSummary | null> => {
    const exact = await this.sessions.getSession(sessionKey);
    if (exact) return exact;
    const summaries = await this.sessions.listSessions();
    return summaries.find((summary) =>
      summary.sessionId.endsWith(`:${sessionKey}`) || sessionLabel(summary) === sessionKey
    ) ?? null;
  };
}
