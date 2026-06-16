import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type CodexRolloutSessionMeta = {
  approvalMode?: string;
  cliVersion?: string;
  cwd?: string;
  memoryMode?: string;
  model?: string;
  modelProvider?: string;
  reasoningEffort?: string;
  sandboxPolicy?: string;
  source?: string;
  timestampMs?: number;
};

export type CodexRolloutSummary = {
  createdAtMs?: number;
  firstUserMessage?: string;
  hasUserEvent: boolean;
  sessionMeta?: CodexRolloutSessionMeta;
  tokensUsed?: number;
  updatedAtMs?: number;
};

export function readCodexRolloutSummary(
  rolloutPath: string,
): CodexRolloutSummary {
  let createdAtMs: number | undefined;
  let firstEventUserMessage: string | undefined;
  let firstResponseUserMessage: string | undefined;
  let hasUserEvent = false;
  let sessionMeta: CodexRolloutSessionMeta | undefined;
  let tokensUsed: number | undefined;
  let updatedAtMs: number | undefined;
  for (const line of readFileSync(rolloutPath, "utf8").split(/\r?\n/)) {
    const entry = readRolloutEntry(line);
    if (!entry) {
      continue;
    }
    const timestampMs = readTimestampMs(entry.timestamp);
    createdAtMs ??= timestampMs;
    updatedAtMs = timestampMs ?? updatedAtMs;
    const payload = isRecord(entry.payload) ? entry.payload : undefined;
    if (entry.type === "session_meta" && isRecord(payload)) {
      sessionMeta = readRolloutSessionMeta(payload);
      createdAtMs ??= sessionMeta.timestampMs;
      updatedAtMs ??= sessionMeta.timestampMs;
    }
    if (entry.type === "event_msg" && isRecord(payload)) {
      hasUserEvent = hasUserEvent || payload.type === "user_message";
      firstEventUserMessage ??=
        payload.type === "user_message"
          ? readString(payload.message)
          : undefined;
      tokensUsed =
        payload.type === "token_count"
          ? readTokenCount(payload) ?? tokensUsed
          : tokensUsed;
    }
    if (isResponseUserMessage(entry, payload)) {
      hasUserEvent = true;
      firstResponseUserMessage ??= readResponseUserMessage(payload);
    }
  }
  return {
    createdAtMs,
    firstUserMessage: firstEventUserMessage ?? firstResponseUserMessage,
    hasUserEvent,
    sessionMeta,
    tokensUsed,
    updatedAtMs,
  };
}

function isResponseUserMessage(
  entry: Record<string, unknown>,
  payload: Record<string, unknown> | undefined,
): payload is Record<string, unknown> {
  return (
    entry.type === "response_item" &&
    isRecord(payload) &&
    payload.role === "user"
  );
}

export function findCodexRolloutPathForThreadId(
  sessionsDirectory: string,
  threadId: string,
): string | undefined {
  if (!existsSync(sessionsDirectory)) {
    return undefined;
  }
  const directories = [sessionsDirectory];
  while (directories.length > 0) {
    const directory = directories.pop();
    if (!directory) {
      continue;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        directories.push(entryPath);
        continue;
      }
      if (
        entry.isFile() &&
        entry.name.endsWith(".jsonl") &&
        entry.name.includes(threadId)
      ) {
        return entryPath;
      }
    }
  }
  return undefined;
}

function readRolloutEntry(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }
  const entry = JSON.parse(trimmed) as unknown;
  return isRecord(entry) ? entry : undefined;
}

function readRolloutSessionMeta(
  payload: Record<string, unknown>,
): CodexRolloutSessionMeta {
  return {
    approvalMode: readString(payload.approval_mode),
    cliVersion: readString(payload.cli_version),
    cwd: readString(payload.cwd),
    memoryMode: readString(payload.memory_mode),
    model: readString(payload.model),
    modelProvider: readString(payload.model_provider),
    reasoningEffort: readString(payload.reasoning_effort),
    sandboxPolicy: readStringOrJson(payload.sandbox_policy),
    source: readString(payload.source),
    timestampMs: readTimestampMs(payload.timestamp),
  };
}

function readResponseUserMessage(
  payload: Record<string, unknown>,
): string | undefined {
  const content = Array.isArray(payload.content) ? payload.content : undefined;
  const parts: string[] = [];
  for (const item of content ?? []) {
    if (!isRecord(item)) {
      continue;
    }
    const text = readString(item.text);
    if (text) {
      parts.push(text);
    }
  }
  return readString(parts.join("\n"));
}

function readTokenCount(payload: Record<string, unknown>): number | undefined {
  const info = isRecord(payload.info) ? payload.info : undefined;
  const usage = isRecord(info?.total_token_usage)
    ? info.total_token_usage
    : undefined;
  return readNumber(usage?.total_tokens);
}

function readStringOrJson(value: unknown): string | undefined {
  const stringValue = readString(value);
  if (stringValue) {
    return stringValue;
  }
  return isRecord(value) ? JSON.stringify(value) : undefined;
}

function readTimestampMs(value: unknown): number | undefined {
  const timestamp = readString(value);
  if (!timestamp) {
    return undefined;
  }
  const timestampMs = Date.parse(timestamp);
  return Number.isFinite(timestampMs) ? timestampMs : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
