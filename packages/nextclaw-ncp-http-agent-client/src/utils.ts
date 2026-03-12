import type { NcpError, NcpErrorCode } from "@nextclaw/ncp";

export const DEFAULT_BASE_PATH = "/ncp/agent";
export const DEFAULT_ENDPOINT_ID = "ncp-http-agent-client";

export type FetchLike = (input: URL | string | Request, init?: RequestInit) => Promise<Response>;

export class NcpHttpAgentClientError extends Error {
  readonly ncpError: NcpError;
  readonly alreadyPublished: boolean;

  constructor(ncpError: NcpError, alreadyPublished = false) {
    super(ncpError.message);
    this.name = `NcpHttpAgentClientError(${ncpError.code})`;
    this.ncpError = ncpError;
    this.alreadyPublished = alreadyPublished;
  }
}

export function toBaseUrl(baseUrl: string): URL {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error("NcpHttpAgentClient requires a non-empty baseUrl.");
  }
  return new URL(trimmed);
}

export function resolveFetchImpl(fetchImpl: FetchLike | undefined): FetchLike {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis) as FetchLike;
  }
  throw new Error("No fetch implementation found. Pass options.fetchImpl explicitly.");
}

export function normalizeBasePath(basePath: string | undefined): string {
  const raw = (basePath ?? DEFAULT_BASE_PATH).trim();
  if (!raw) {
    return DEFAULT_BASE_PATH;
  }
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

export async function safeReadText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim();
  } catch {
    return "";
  }
}

export function toNcpError(error: unknown): NcpError {
  if (isNcpHttpAgentClientError(error)) {
    return error.ncpError;
  }
  if (isNcpError(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return {
    code: normalizeErrorCode(undefined),
    message,
    ...(error instanceof Error && error.stack ? { details: { stack: error.stack } } : {}),
  };
}

export function ncpErrorToError(
  error: NcpError,
  options: { alreadyPublished?: boolean } = {},
): NcpHttpAgentClientError {
  return new NcpHttpAgentClientError(error, options.alreadyPublished ?? false);
}

function isNcpError(value: unknown): value is NcpError {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isNcpHttpAgentClientError(error: unknown): error is NcpHttpAgentClientError {
  return error instanceof NcpHttpAgentClientError;
}

const ERROR_CODE_MAP: Record<string, NcpErrorCode> = {
  "config-error": "config-error",
  "auth-error": "auth-error",
  "runtime-error": "runtime-error",
  "timeout-error": "timeout-error",
  "abort-error": "abort-error",
};

export function normalizeErrorCode(code: string | undefined): NcpErrorCode {
  if (!code) {
    return "runtime-error";
  }
  const mapped = ERROR_CODE_MAP[code];
  if (mapped) {
    return mapped;
  }
  const lowered = code.toLowerCase();
  if (lowered.includes("timeout")) return "timeout-error";
  if (lowered.includes("abort") || lowered.includes("cancel")) return "abort-error";
  if (lowered.includes("auth")) return "auth-error";
  if (lowered.includes("config")) return "config-error";
  return "runtime-error";
}
