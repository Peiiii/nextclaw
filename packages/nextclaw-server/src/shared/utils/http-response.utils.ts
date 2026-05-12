export function ok<T>(data: T) {
  return { ok: true, data };
}

export function err(code: string, message: string, details?: Record<string, unknown>) {
  return { ok: false, error: { code, message, details } };
}

export async function readJson<T>(req: Request): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) {
    return fallback;
  }

  const maybeError = value.error;
  if (!isRecord(maybeError)) {
    return fallback;
  }

  return typeof maybeError.message === "string" && maybeError.message.trim().length > 0
    ? maybeError.message
    : fallback;
}

export function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function formatUserFacingError(error: unknown, maxChars = 320): string {
  const raw =
    error instanceof Error ? error.message || error.name || "Unknown error" : String(error ?? "Unknown error");
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Unknown error";
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}
