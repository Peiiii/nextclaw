import { Tool } from "@nextclaw/core";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";

const DEFAULT_LIMIT = 20;
const MAX_MESSAGE_LIMIT = 20;

function toInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sanitizeMessage(message: { role?: string; parts?: unknown; content?: unknown; timestamp?: string }) {
  return {
    role: message.role,
    content: message.content ?? message.parts,
    timestamp: message.timestamp,
  };
}

export class SessionsListTool extends Tool {
  constructor(private readonly sessions: NcpSessionManager) {
    super();
  }

  get name(): string {
    return "sessions_list";
  }

  get description(): string {
    return "List available sessions with timestamps.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        sessionKey: { type: "string", description: "Only include the exact session key" },
        limit: { type: "integer", minimum: 1, description: "Maximum number of sessions to return" },
        messageLimit: { type: "integer", minimum: 0, description: "Include last N messages (max 20)" },
      },
    };
  }

  execute = async (params: Record<string, unknown>): Promise<string> => {
    const sessionKey = readOptionalString(params.sessionKey);
    const limit = toInt(params.limit, DEFAULT_LIMIT);
    const messageLimit = Math.min(toInt(params.messageLimit, 0), MAX_MESSAGE_LIMIT);
    const summaries = await this.sessions.listSessions({ limit });
    const sessions = [];
    for (const summary of summaries) {
      if (sessionKey && summary.sessionId !== sessionKey) {
        continue;
      }
      const entry: Record<string, unknown> = {
        key: summary.sessionId,
        sessionId: summary.sessionId,
        agentId: summary.agentId,
        title: readOptionalString(summary.metadata?.label),
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        status: summary.status,
      };
      if (messageLimit > 0) {
        const messages = await this.sessions.listSessionMessages(summary.sessionId, { limit: messageLimit });
        entry.messages = messages.map(sanitizeMessage);
      }
      sessions.push(entry);
    }
    return JSON.stringify({ sessions }, null, 2);
  };
}

export class SessionsHistoryTool extends Tool {
  constructor(private readonly sessions: NcpSessionManager) {
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
        sessionKey: { type: "string", description: "Session id" },
        limit: { type: "integer", minimum: 1, description: "Maximum number of messages to return" },
      },
      required: ["sessionKey"],
    };
  }

  execute = async (params: Record<string, unknown>): Promise<string> => {
    const sessionKey = readOptionalString(params.sessionKey);
    if (!sessionKey) {
      return "Error: sessionKey is required";
    }
    const session = await this.sessions.getSession(sessionKey);
    if (!session) {
      return `Error: session '${sessionKey}' not found`;
    }
    const messages = await this.sessions.listSessionMessages(sessionKey, { limit: toInt(params.limit, DEFAULT_LIMIT) });
    return JSON.stringify({ sessionKey, messages: messages.map(sanitizeMessage) }, null, 2);
  };
}
