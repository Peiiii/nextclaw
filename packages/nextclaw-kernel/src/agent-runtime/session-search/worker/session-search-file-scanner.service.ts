import type { SessionMessage } from "@nextclaw/core";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { createHash } from "node:crypto";
import { open, readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { toNcpMessages } from "@kernel/agent-runtime/session/nextclaw-agent-session-message-adapter.utils.js";

const FIRST_LINE_CHUNK_SIZE = 4096;
const MAX_FIRST_LINE_BYTES = 65536;

export type SessionSearchFileSummary = {
  sessionId: string;
  path: string;
  updatedAt: string;
  contentHash: string;
};

type SessionSearchFileReadState = {
  messages: SessionMessage[];
  metadata: Record<string, unknown>;
  agentId?: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toSessionId(fileName: string): string {
  return basename(fileName, ".jsonl").replace(/_/g, ":");
}

function toIsoTimestamp(value: unknown, fallback: string): string {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function createLegacyMessage(data: Record<string, unknown>, fallbackTimestamp: string): SessionMessage {
  return {
    ...data,
    role: toOptionalString(data.role) ?? "assistant",
    timestamp: toIsoTimestamp(data.timestamp, fallbackTimestamp),
    content: Object.prototype.hasOwnProperty.call(data, "content") ? data.content : "",
  } as SessionMessage;
}

function projectMessageFromEvent(data: Record<string, unknown>, fallbackTimestamp: string): SessionMessage | null {
  const source = isRecord(data.message) ? data.message : data;
  const role = toOptionalString(source.role);
  if (!role) {
    return null;
  }
  return {
    ...source,
    role,
    timestamp: toIsoTimestamp(source.timestamp, fallbackTimestamp),
    content: Object.prototype.hasOwnProperty.call(source, "content") ? source.content : "",
  } as SessionMessage;
}

function createContentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function readFirstLine(path: string): Promise<string> {
  const handle = await open(path, "r");
  try {
    const chunks: Buffer[] = [];
    let position = 0;
    let totalLength = 0;
    while (totalLength < MAX_FIRST_LINE_BYTES) {
      const buffer = Buffer.alloc(FIRST_LINE_CHUNK_SIZE);
      const result = await handle.read(buffer, 0, FIRST_LINE_CHUNK_SIZE, position);
      if (result.bytesRead <= 0) {
        break;
      }
      const chunk = buffer.subarray(0, result.bytesRead);
      const newlineIndex = chunk.indexOf(10);
      const lineChunk = newlineIndex >= 0 ? chunk.subarray(0, newlineIndex) : chunk;
      chunks.push(lineChunk);
      totalLength += lineChunk.length;
      if (newlineIndex >= 0) {
        break;
      }
      position += result.bytesRead;
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await handle.close();
  }
}

export class SessionSearchFileScannerService {
  constructor(private readonly sessionsDir: string) {}

  listSessionFiles = async (): Promise<SessionSearchFileSummary[]> => {
    const entries = await readdir(this.sessionsDir, { withFileTypes: true }).catch(() => []);
    const summaries: SessionSearchFileSummary[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
        continue;
      }
      const summary = await this.readFileSummary(entry.name);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  };

  readSession = async (summary: SessionSearchFileSummary): Promise<AgentSessionRecord | null> => {
    const raw = await readFile(summary.path, "utf8").catch(() => "");
    if (!raw) {
      return null;
    }

    const fallbackTimestamp = new Date().toISOString();
    const state: SessionSearchFileReadState = {
      messages: [],
      metadata: {},
      updatedAt: summary.updatedAt,
    };

    for (const line of raw.split("\n")) {
      const data = this.parseLine(line);
      if (!data) {
        continue;
      }
      this.applySessionLine(state, data, fallbackTimestamp);
    }

    return {
      sessionId: summary.sessionId,
      ...(state.agentId ? { agentId: state.agentId } : {}),
      messages: toNcpMessages(summary.sessionId, state.messages),
      updatedAt: state.updatedAt,
      metadata: state.metadata,
    };
  };

  private readFileSummary = async (fileName: string): Promise<SessionSearchFileSummary | null> => {
    const path = join(this.sessionsDir, fileName);
    const fileStat = await stat(path).catch(() => null);
    if (!fileStat?.isFile()) {
      return null;
    }
    const firstLine = await readFirstLine(path).catch(() => "");
    if (!firstLine) {
      return null;
    }
    try {
      const metadata = JSON.parse(firstLine) as Record<string, unknown>;
      if (metadata._type !== "metadata") {
        return null;
      }
      const updatedAt = toIsoTimestamp(metadata.updated_at, fileStat.mtime.toISOString());
      return {
        sessionId: toSessionId(fileName),
        path,
        updatedAt,
        contentHash: createContentHash(`${updatedAt}:${fileStat.size}:${Math.trunc(fileStat.mtimeMs)}`),
      };
    } catch {
      return null;
    }
  };

  private parseLine = (line: string): Record<string, unknown> | null => {
    if (!line.trim()) {
      return null;
    }
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  private applySessionLine = (
    state: SessionSearchFileReadState,
    data: Record<string, unknown>,
    fallbackTimestamp: string,
  ): void => {
    if (data._type === "metadata") {
      this.applyMetadataLine(state, data);
      return;
    }
    if (data._type === "event") {
      this.applyEventLine(state, data, fallbackTimestamp);
      return;
    }
    state.messages.push(createLegacyMessage(data, fallbackTimestamp));
  };

  private applyMetadataLine = (
    state: SessionSearchFileReadState,
    data: Record<string, unknown>,
  ): void => {
    state.metadata = isRecord(data.metadata) ? data.metadata : {};
    state.agentId = toOptionalString(data.agent_id)?.toLowerCase();
    state.updatedAt = toIsoTimestamp(data.updated_at, state.updatedAt);
  };

  private applyEventLine = (
    state: SessionSearchFileReadState,
    data: Record<string, unknown>,
    fallbackTimestamp: string,
  ): void => {
    const eventData = isRecord(data.data) ? data.data : {};
    const message = projectMessageFromEvent(eventData, toIsoTimestamp(data.timestamp, fallbackTimestamp));
    if (message) {
      state.messages.push(message);
    }
  };
}
