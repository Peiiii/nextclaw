import type {
  NcpMessageAbortPayload,
  NcpRequestEnvelope,
  NcpResumeRequestPayload,
} from "@nextclaw/ncp";
import {
  DEFAULT_BASE_PATH,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./types.js";

export function normalizeBasePath(basePath: string | undefined): string {
  const raw = (basePath ?? DEFAULT_BASE_PATH).trim();
  if (!raw) {
    return DEFAULT_BASE_PATH;
  }
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function sanitizeTimeout(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }
  return Math.max(1_000, Math.trunc(timeoutMs));
}

export async function parseRequestEnvelope(request: Request): Promise<NcpRequestEnvelope | null> {
  try {
    const payload = (await request.json()) as unknown;
    if (!isRecord(payload)) {
      return null;
    }
    if (typeof payload.sessionId !== "string" || !payload.sessionId.trim()) {
      return null;
    }
    if (!isRecord(payload.message)) {
      return null;
    }
    return payload as NcpRequestEnvelope;
  } catch {
    return null;
  }
}

export function parseResumePayloadFromUrl(url: string): NcpResumeRequestPayload | null {
  const query = new URL(url).searchParams;
  const sessionId = query.get("sessionId")?.trim();
  const remoteRunId = query.get("remoteRunId")?.trim();
  if (!sessionId || !remoteRunId) {
    return null;
  }

  const fromEventIndexRaw = query.get("fromEventIndex");
  const fromEventIndex =
    typeof fromEventIndexRaw === "string" && Number.isFinite(Number.parseInt(fromEventIndexRaw, 10))
      ? Math.max(0, Number.parseInt(fromEventIndexRaw, 10))
      : undefined;

  return {
    sessionId,
    remoteRunId,
    ...(typeof fromEventIndex === "number" ? { fromEventIndex } : {}),
  };
}

export async function parseAbortPayload(request: Request): Promise<NcpMessageAbortPayload> {
  try {
    const payload = (await request.json()) as unknown;
    if (!isRecord(payload)) {
      return {};
    }
    const messageId = readTrimmedString(payload.messageId);
    const correlationId = readTrimmedString(payload.correlationId);
    const runId = readTrimmedString(payload.runId);

    return {
      ...(messageId ? { messageId } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(runId ? { runId } : {}),
    };
  } catch {
    return {};
  }
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
