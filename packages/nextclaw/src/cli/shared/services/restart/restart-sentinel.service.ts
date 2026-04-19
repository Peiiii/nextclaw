import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDataDir, type SessionManager } from "@nextclaw/core";

export type RestartSentinelDeliveryContext = {
  channel?: string;
  chatId?: string;
  replyTo?: string | null;
  accountId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RestartSentinelPayload = {
  kind: "config.apply" | "config.patch" | "update.run" | "restart";
  status: "ok" | "error" | "skipped";
  ts: number;
  sessionKey?: string;
  deliveryContext?: RestartSentinelDeliveryContext;
  message?: string | null;
  stats?: {
    reason?: string | null;
    strategy?: string | null;
    durationMs?: number | null;
  };
};

type RestartSentinelFile = {
  version: 1;
  payload: RestartSentinelPayload;
};

const RESTART_SENTINEL_FILENAME = "restart-sentinel.json";
const PENDING_SYSTEM_EVENTS_KEY = "pending_system_events";
const RESTART_REASON_MAX_CHARS = 240;
const RESTART_NOTE_MAX_CHARS = 600;
const RESTART_OUTBOUND_MAX_CHARS = 1200;

function trimTo(value: string, maxChars: number): string {
  const text = value.trim();
  if (!text) {
    return "";
  }
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function normalizeLine(value: string, maxChars: number): string | null {
  const trimmed = trimTo(value, maxChars);
  return trimmed ? trimmed : null;
}

export function resolveRestartSentinelPath(): string {
  return resolve(getDataDir(), "run", RESTART_SENTINEL_FILENAME);
}

export async function writeRestartSentinel(payload: RestartSentinelPayload): Promise<string> {
  const path = resolveRestartSentinelPath();
  mkdirSync(resolve(path, ".."), { recursive: true });
  const file: RestartSentinelFile = {
    version: 1,
    payload
  };
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, "utf-8");
  return path;
}

export async function consumeRestartSentinel(): Promise<RestartSentinelFile | null> {
  const path = resolveRestartSentinelPath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as RestartSentinelFile;
    if (!parsed || parsed.version !== 1 || !parsed.payload) {
      rmSync(path, { force: true });
      return null;
    }
    rmSync(path, { force: true });
    return parsed;
  } catch {
    rmSync(path, { force: true });
    return null;
  }
}

export function summarizeRestartSentinel(payload: RestartSentinelPayload): string {
  const reason = normalizeLine(payload.stats?.reason ?? "", RESTART_REASON_MAX_CHARS);
  if (payload.kind === "update.run") {
    return payload.status === "ok"
      ? "✅ NextClaw update completed and service restarted."
      : "⚠️ NextClaw update finished with issues.";
  }
  if (payload.kind === "config.apply" || payload.kind === "config.patch") {
    return payload.status === "ok"
      ? "✅ Config applied and service restarted."
      : "⚠️ Config change restart finished with issues.";
  }
  if (reason) {
    return `Gateway restart complete (${reason}).`;
  }
  return "Gateway restart complete.";
}

export function formatRestartSentinelMessage(payload: RestartSentinelPayload): string {
  const lines = [summarizeRestartSentinel(payload)];
  const note = normalizeLine(payload.message ?? "", RESTART_NOTE_MAX_CHARS);
  if (note) {
    lines.push(note);
  }
  const reason = normalizeLine(payload.stats?.reason ?? "", RESTART_REASON_MAX_CHARS);
  if (reason && !lines.some((line) => line.includes(reason))) {
    lines.push(`Reason: ${reason}`);
  }

  const message = lines.join("\n").trim();
  return trimTo(message, RESTART_OUTBOUND_MAX_CHARS);
}

export function parseSessionKey(
  sessionKey?: string
): { channel: string; chatId: string } | null {
  const value = sessionKey?.trim();
  if (!value) {
    return null;
  }
  const separator = value.indexOf(":");
  if (separator <= 0 || separator >= value.length - 1) {
    return null;
  }
  return {
    channel: value.slice(0, separator),
    chatId: value.slice(separator + 1)
  };
}

export function enqueuePendingSystemEvent(
  sessionManager: SessionManager,
  sessionKey: string,
  message: string
): void {
  const text = message.trim();
  if (!text) {
    return;
  }
  const session = sessionManager.getOrCreate(sessionKey);
  const queueRaw = session.metadata[PENDING_SYSTEM_EVENTS_KEY];
  const queue = Array.isArray(queueRaw)
    ? queueRaw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  if (queue.at(-1) === text) {
    return;
  }
  queue.push(text);
  if (queue.length > 20) {
    queue.splice(0, queue.length - 20);
  }
  session.metadata[PENDING_SYSTEM_EVENTS_KEY] = queue;
  session.updatedAt = new Date();
  sessionManager.save(session);
}
