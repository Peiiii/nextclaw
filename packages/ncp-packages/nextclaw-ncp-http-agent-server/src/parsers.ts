import type {
  NcpAgentSendEnvelope,
  NcpMessageAbortPayload,
  NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import { DEFAULT_BASE_PATH } from "./types.js";

export function normalizeBasePath(basePath: string | undefined): string {
  const raw = (basePath ?? DEFAULT_BASE_PATH).trim();
  if (!raw) {
    return DEFAULT_BASE_PATH;
  }
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function sanitizeTimeout(timeoutMs: number | null | undefined): number | null {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return null;
  }
  if (timeoutMs <= 0) {
    return null;
  }
  return Math.max(1_000, Math.trunc(timeoutMs));
}

export async function parseRequestEnvelope(request: Request): Promise<NcpAgentSendEnvelope | null> {
  try {
    const payload = (await request.json()) as unknown;
    if (!isRecord(payload)) {
      return null;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "sessionId") &&
      (typeof payload.sessionId !== "string" || !payload.sessionId.trim())
    ) {
      return null;
    }
    if (!isRecord(payload.message)) {
      return null;
    }
    return payload as NcpAgentSendEnvelope;
  } catch {
    return null;
  }
}

export function parseStreamPayloadFromUrl(url: string): NcpStreamRequestPayload | null {
  const query = new URL(url).searchParams;
  const sessionId = query.get("sessionId")?.trim();
  if (!sessionId) {
    return null;
  }

  return {
    sessionId,
  };
}

export async function parseAbortPayload(request: Request): Promise<NcpMessageAbortPayload | null> {
  try {
    const payload = (await request.json()) as unknown;
    if (!isRecord(payload)) {
      return null;
    }
    const sessionId = readTrimmedString(payload.sessionId);
    if (!sessionId) {
      return null;
    }
    const messageId = readTrimmedString(payload.messageId);

    return {
      sessionId,
      ...(messageId ? { messageId } : {}),
    };
  } catch {
    return null;
  }
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
