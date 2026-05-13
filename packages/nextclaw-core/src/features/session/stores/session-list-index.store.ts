import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionListRecord } from "@core/features/session/types/session-list.types.js";

const FIRST_LINE_BUFFER_BYTES = 8192;
const SESSION_LIST_INDEX_FILE = ".session-list-index.json";
const SESSION_LIST_INDEX_VERSION = 1;
const SESSION_LIST_METADATA_KEYS = [
  "label",
  "preferred_model",
  "preferredModel",
  "model",
  "preferred_thinking",
  "thinking",
  "thinking_level",
  "thinkingLevel",
  "project_root",
  "projectRoot",
  "ui_last_read_at",
  "runtime",
  "session_type",
  "sessionType",
  "parent_session_id",
  "parentSessionId",
  "spawned_by_request_id",
  "spawnedByRequestId",
  "child_session_promoted",
] as const;

type SessionListIndex = {
  version: typeof SESSION_LIST_INDEX_VERSION;
  records: SessionListRecord[];
};

export type SessionListIndexSource = {
  key: string;
  agentId?: string;
  messages: Array<{ timestamp: string }>;
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
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function toOptionalAgentId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalNonNegativeInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function toOptionalIsoString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function createSessionListMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of SESSION_LIST_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      result[key] = metadata[key];
    }
  }
  return result;
}

function cloneSessionListRecords(records: SessionListRecord[]): SessionListRecord[] {
  return records.map((record) => ({
    ...record,
    metadata: structuredClone(record.metadata),
  }));
}

function readFirstLine(path: string): string {
  const fd = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(FIRST_LINE_BUFFER_BYTES);
  const chunks: Buffer[] = [];
  let position = 0;
  try {
    while (true) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, position);
      if (bytesRead <= 0) {
        break;
      }
      const chunk = buffer.subarray(0, bytesRead);
      const newlineIndex = chunk.indexOf(10);
      if (newlineIndex >= 0) {
        chunks.push(Buffer.from(chunk.subarray(0, newlineIndex)));
        break;
      }
      chunks.push(Buffer.from(chunk));
      position += bytesRead;
    }
  } finally {
    closeSync(fd);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function createSessionListRecordFromState(session: SessionListIndexSource, path: string): SessionListRecord {
  const lastMessageAt = session.messages.at(-1)?.timestamp;
  return {
    key: session.key,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
    path,
    ...(session.agentId ? { agentId: session.agentId } : {}),
    messageCount: session.messages.length,
    ...(lastMessageAt ? { lastMessageAt } : {}),
    metadata: createSessionListMetadata(session.metadata),
  };
}

function createSessionListRecordFromLine(params: {
  key: string;
  path: string;
  firstLine: string;
}): SessionListRecord | null {
  try {
    const data = JSON.parse(params.firstLine) as Record<string, unknown>;
    if (data._type !== "metadata") {
      return null;
    }
    const listMetadata = isRecord(data.list_metadata) ? data.list_metadata : data.metadata;
    return {
      key: params.key,
      created_at: toIsoString(data.created_at, new Date(0).toISOString()),
      updated_at: toIsoString(data.updated_at, new Date(0).toISOString()),
      path: params.path,
      ...(toOptionalAgentId(data.agent_id) ? { agentId: toOptionalAgentId(data.agent_id) } : {}),
      ...(toOptionalNonNegativeInt(data.message_count) ? { messageCount: toOptionalNonNegativeInt(data.message_count) } : {}),
      ...(toOptionalIsoString(data.last_message_at) ? { lastMessageAt: toOptionalIsoString(data.last_message_at) } : {}),
      metadata: isRecord(listMetadata) ? createSessionListMetadata(listMetadata) : {},
    };
  } catch {
    return null;
  }
}

export class SessionListIndexStore {
  private listCache: SessionListRecord[] | null = null;

  constructor(private readonly sessionsDir: string) {}

  listSessions = (): SessionListRecord[] => {
    const indexed = this.read();
    if (indexed) {
      return indexed;
    }
    const sessions = this.scan();
    this.write(sessions);
    return cloneSessionListRecords(sessions);
  };

  upsertSession = (session: SessionListIndexSource, path: string): void => {
    const records = this.read() ?? this.scan();
    const record = createSessionListRecordFromState(session, path);
    this.write([record, ...records.filter((item) => item.key !== record.key)]);
  };

  removeSession = (key: string): void => {
    const records = this.read();
    if (records) {
      this.write(records.filter((item) => item.key !== key));
    }
  };

  private readonly indexPath = (): string => join(this.sessionsDir, SESSION_LIST_INDEX_FILE);

  private read = (): SessionListRecord[] | null => {
    if (this.listCache) {
      return cloneSessionListRecords(this.listCache);
    }
    try {
      const data = JSON.parse(readFileSync(this.indexPath(), "utf-8")) as SessionListIndex;
      if (data.version !== SESSION_LIST_INDEX_VERSION || !Array.isArray(data.records)) {
        return null;
      }
      this.listCache = data.records;
      return cloneSessionListRecords(data.records);
    } catch {
      return null;
    }
  };

  private write = (records: SessionListRecord[]): void => {
    this.listCache = cloneSessionListRecords(records);
    writeFileSync(
      this.indexPath(),
      `${JSON.stringify({ version: SESSION_LIST_INDEX_VERSION, records: this.listCache })}\n`,
    );
  };

  private scan = (): SessionListRecord[] => {
    const sessions: SessionListRecord[] = [];
    if (!existsSync(this.sessionsDir)) {
      return sessions;
    }
    for (const entry of readdirSync(this.sessionsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
        continue;
      }
      const path = join(this.sessionsDir, entry.name);
      const record = createSessionListRecordFromLine({
        key: entry.name.replace(/\.jsonl$/, "").replace(/_/g, ":"),
        path,
        firstLine: readFirstLine(path),
      });
      if (record) {
        sessions.push(record);
      }
    }
    return sessions;
  };
}
