import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { safeFilename, getSessionsPath } from "../utils/helpers.js";

export type SessionMessage = {
  role: string;
  content: unknown;
  timestamp: string;
  [key: string]: unknown;
};

export type SessionEvent = {
  seq: number;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
};

export type Session = {
  key: string;
  messages: SessionMessage[];
  events: SessionEvent[];
  nextSeq: number;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toIsoString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
}

type PendingToolCalls = {
  expectedIds: Set<string>;
  blockStart: number;
};

type SessionLoadState = {
  events: SessionEvent[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  fallbackSeq: number;
};

function collectExpectedToolCallIds(message: SessionMessage): Set<string> {
  const expectedIds = new Set<string>();
  if (!Array.isArray(message.tool_calls)) {
    return expectedIds;
  }
  for (const call of message.tool_calls as Array<Record<string, unknown>>) {
    const callId = typeof call.id === "string" ? call.id.trim() : "";
    if (callId) {
      expectedIds.add(callId);
    }
  }
  return expectedIds;
}

function resetPendingToolCalls(
  normalized: SessionMessage[],
  pendingToolCalls: PendingToolCalls | null,
  role: string,
): PendingToolCalls | null {
  if (!pendingToolCalls || role === "tool") {
    return pendingToolCalls;
  }
  if (pendingToolCalls.expectedIds.size > 0) {
    normalized.splice(pendingToolCalls.blockStart);
  }
  return null;
}

function appendAssistantMessage(
  normalized: SessionMessage[],
  message: SessionMessage,
): PendingToolCalls | null {
  normalized.push(message);
  const expectedIds = collectExpectedToolCallIds(message);
  if (expectedIds.size === 0) {
    return null;
  }
  return {
    expectedIds,
    blockStart: normalized.length - 1,
  };
}

function appendToolMessage(
  normalized: SessionMessage[],
  message: SessionMessage,
  pendingToolCalls: PendingToolCalls | null,
): PendingToolCalls | null {
  if (!pendingToolCalls) {
    return null;
  }
  const callId = typeof message.tool_call_id === "string" ? message.tool_call_id.trim() : "";
  if (!callId || !pendingToolCalls.expectedIds.has(callId)) {
    return pendingToolCalls;
  }
  normalized.push(message);
  pendingToolCalls.expectedIds.delete(callId);
  return pendingToolCalls.expectedIds.size > 0 ? pendingToolCalls : null;
}

function finalizePendingToolCalls(normalized: SessionMessage[], pendingToolCalls: PendingToolCalls | null): void {
  if (pendingToolCalls && pendingToolCalls.expectedIds.size > 0) {
    normalized.splice(pendingToolCalls.blockStart);
  }
}

function normalizeSessionHistoryWindow(messages: SessionMessage[]): SessionMessage[] {
  const normalized: SessionMessage[] = [];
  let pendingToolCalls: PendingToolCalls | null = null;

  for (const message of messages) {
    const role = typeof message.role === "string" ? message.role : "";
    pendingToolCalls = resetPendingToolCalls(normalized, pendingToolCalls, role);

    if (role === "assistant") {
      pendingToolCalls = appendAssistantMessage(normalized, message);
      continue;
    }

    if (role === "tool") {
      pendingToolCalls = appendToolMessage(normalized, message, pendingToolCalls);
      continue;
    }

    normalized.push(message);
  }

  finalizePendingToolCalls(normalized, pendingToolCalls);
  return normalized;
}

function createSessionLoadState(): SessionLoadState {
  return {
    events: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    fallbackSeq: 1,
  };
}

function appendSessionEvent(state: SessionLoadState, event: SessionEvent): void {
  state.events.push(event);
  state.fallbackSeq = Math.max(state.fallbackSeq, event.seq + 1);
}

function applyMetadataLine(state: SessionLoadState, data: Record<string, unknown>): boolean {
  if (data._type !== "metadata") {
    return false;
  }
  state.metadata = (data.metadata as Record<string, unknown>) ?? {};
  if (data.created_at) {
    state.createdAt = new Date(String(data.created_at));
  }
  if (data.updated_at) {
    state.updatedAt = new Date(String(data.updated_at));
  }
  return true;
}

function applyEventLine(state: SessionLoadState, data: Record<string, unknown>): boolean {
  if (data._type !== "event") {
    return false;
  }
  const rawSeq = Number(data.seq);
  const seq = Number.isFinite(rawSeq) && rawSeq > 0 ? Math.trunc(rawSeq) : state.fallbackSeq;
  const timestamp = toIsoString(data.timestamp, new Date().toISOString());
  const type = typeof data.type === "string" && data.type.trim() ? data.type.trim() : "message.other";
  const payload = isRecord(data.data) ? data.data : {};
  appendSessionEvent(state, { seq, type, timestamp, data: payload });
  return true;
}

function createLegacyMessage(data: Record<string, unknown>): SessionMessage {
  const legacyRole = typeof data.role === "string" ? data.role : "assistant";
  const legacyTimestamp = toIsoString(data.timestamp, new Date().toISOString());
  return {
    ...data,
    role: legacyRole,
    timestamp: legacyTimestamp,
    content: Object.prototype.hasOwnProperty.call(data, "content") ? data.content : "",
  } as SessionMessage;
}

function applyLegacyLine(
  state: SessionLoadState,
  data: Record<string, unknown>,
  resolveMessageEventType: (message: SessionMessage) => string,
): void {
  const message = createLegacyMessage(data);
  appendSessionEvent(state, {
    seq: state.fallbackSeq,
    type: resolveMessageEventType(message),
    timestamp: message.timestamp,
    data: { message },
  });
}

function sortSessionEvents(events: SessionEvent[]): void {
  events.sort((left, right) => {
    if (left.seq !== right.seq) {
      return left.seq - right.seq;
    }
    return Date.parse(left.timestamp) - Date.parse(right.timestamp);
  });
}

function buildLoadedSession(params: {
  key: string;
  state: SessionLoadState;
  projectMessageFromEvent: (event: SessionEvent) => SessionMessage | null;
}): Session {
  sortSessionEvents(params.state.events);
  const messages = params.state.events
    .map((event) => params.projectMessageFromEvent(event))
    .filter((message): message is SessionMessage => Boolean(message));
  const latestTs =
    params.state.events.length > 0 ? params.state.events[params.state.events.length - 1]?.timestamp : null;
  if (latestTs) {
    params.state.updatedAt = new Date(latestTs);
  }
  const nextSeq = params.state.events.reduce((maxSeq, event) => Math.max(maxSeq, event.seq), 0) + 1;

  return {
    key: params.key,
    messages,
    events: params.state.events,
    nextSeq,
    createdAt: params.state.createdAt,
    updatedAt: params.state.updatedAt,
    metadata: params.state.metadata,
  };
}

export class SessionManager {
  private sessionsDir: string;
  private cache: Map<string, Session> = new Map();

  constructor(private workspace: string) {
    this.sessionsDir = getSessionsPath();
  }

  private getSessionPath = (key: string): string => {
    const safeKey = safeFilename(key.replace(/:/g, "_"));
    return join(this.sessionsDir, `${safeKey}.jsonl`);
  };

  getOrCreate = (key: string): Session => {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const loaded = this.load(key);
    const session = loaded ?? {
      key,
      messages: [],
      events: [],
      nextSeq: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };
    this.cache.set(key, session);
    return session;
  };

  getIfExists = (key: string): Session | null => {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const loaded = this.load(key);
    if (loaded) {
      this.cache.set(key, loaded);
    }
    return loaded;
  };

  appendEvent = (
    session: Session,
    params: {
      type: string;
      data?: Record<string, unknown>;
      timestamp?: string;
    }
  ): SessionEvent => {
    const timestamp = toIsoString(params.timestamp, new Date().toISOString());
    const event: SessionEvent = {
      seq: session.nextSeq,
      type: params.type,
      timestamp,
      data: params.data ?? {}
    };
    session.nextSeq += 1;
    session.events.push(event);

    const projected = this.projectMessageFromEvent(event);
    if (projected) {
      session.messages.push(projected);
    }

    session.updatedAt = new Date(timestamp);
    return event;
  };

  addMessage = (session: Session, role: string, content: unknown, extra: Record<string, unknown> = {}): SessionEvent => {
    const msg: SessionMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...extra
    };

    const eventType = this.resolveMessageEventType(msg);
    return this.appendEvent(session, {
      type: eventType,
      timestamp: msg.timestamp,
      data: { message: msg }
    });
  };

  getHistory = (session: Session, maxMessages = 50): Array<Record<string, unknown>> => {
    const recent = session.messages.length > maxMessages ? session.messages.slice(-maxMessages) : session.messages;
    const normalized = this.normalizeHistoryWindow(recent);
    return normalized.map((msg) => {
      const entry: Record<string, unknown> = {
        role: msg.role,
        content: msg.content
      };
      if (typeof msg.name === "string") {
        entry.name = msg.name;
      }
      if (typeof msg.tool_call_id === "string") {
        entry.tool_call_id = msg.tool_call_id;
      }
      if (Array.isArray(msg.tool_calls)) {
        entry.tool_calls = msg.tool_calls;
      }
      if (typeof msg.reasoning_content === "string" && msg.reasoning_content) {
        entry.reasoning_content = msg.reasoning_content;
      }
      return entry;
    });
  };

  private normalizeHistoryWindow = (messages: SessionMessage[]): SessionMessage[] => normalizeSessionHistoryWindow(messages);

  clear = (session: Session): void => {
    session.events = [];
    session.messages = [];
    session.nextSeq = 1;
    session.updatedAt = new Date();
  };

  private projectMessageFromEvent = (event: SessionEvent): SessionMessage | null => {
    const source = isRecord(event.data.message)
      ? event.data.message
      : isRecord(event.data)
        ? event.data
        : null;
    if (!source) {
      return null;
    }

    const role = typeof source.role === "string" ? source.role : "";
    if (!role) {
      return null;
    }

    const timestamp = toIsoString(source.timestamp, event.timestamp);
    return {
      ...source,
      role,
      timestamp,
      content: Object.prototype.hasOwnProperty.call(source, "content") ? source.content : ""
    };
  };

  private resolveMessageEventType = (message: SessionMessage): string => {
    const role = typeof message.role === "string" ? message.role.trim().toLowerCase() : "";
    if (role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      return "assistant.tool_call";
    }
    if (role === "tool") {
      return "tool.result";
    }
    if (role === "assistant") {
      return "message.assistant";
    }
    if (role === "user") {
      return "message.user";
    }
    if (role === "system") {
      return "message.system";
    }
    return `message.${role || "other"}`;
  };

  private load = (key: string): Session | null => {
    const path = this.getSessionPath(key);
    if (!existsSync(path)) {
      return null;
    }
    try {
      const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
      const state = createSessionLoadState();

      for (const line of lines) {
        const data = JSON.parse(line) as Record<string, unknown>;
        if (applyMetadataLine(state, data) || applyEventLine(state, data)) {
          continue;
        }
        applyLegacyLine(state, data, this.resolveMessageEventType);
      }
      return buildLoadedSession({
        key,
        state,
        projectMessageFromEvent: this.projectMessageFromEvent,
      });
    } catch {
      return null;
    }
  };

  save = (session: Session): void => {
    const path = this.getSessionPath(session.key);
    const metadataLine = {
      _type: "metadata",
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
      metadata: session.metadata
    };
    const eventLines = session.events.map((event) =>
      JSON.stringify({
        _type: "event",
        seq: event.seq,
        type: event.type,
        timestamp: event.timestamp,
        data: event.data
      })
    );
    const lines = [JSON.stringify(metadataLine), ...eventLines].join("\n");
    writeFileSync(path, `${lines}\n`);
    this.cache.set(session.key, session);
  };

  delete = (key: string): boolean => {
    this.cache.delete(key);
    const path = this.getSessionPath(key);
    if (existsSync(path)) {
      unlinkSync(path);
      return true;
    }
    return false;
  };

  listSessions = (): Array<Record<string, unknown>> => {
    const sessions: Array<Record<string, unknown>> = [];
    for (const entry of readdirSync(this.sessionsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
        continue;
      }
      const path = join(this.sessionsDir, entry.name);
      const firstLine = readFileSync(path, "utf-8").split("\n")[0];
      if (!firstLine) {
        continue;
      }
      try {
        const data = JSON.parse(firstLine) as Record<string, unknown>;
        if (data._type === "metadata") {
          sessions.push({
            key: entry.name.replace(/\.jsonl$/, "").replace(/_/g, ":"),
            created_at: data.created_at,
            updated_at: data.updated_at,
            path,
            metadata: data.metadata ?? {}
          });
        }
      } catch {
        continue;
      }
    }
    return sessions;
  };
}
