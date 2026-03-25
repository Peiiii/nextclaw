export function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const DEFAULT_CLAUDE_EXECUTION_PROBE_TIMEOUT_MS = 30_000;

export function resolveClaudeExecutionProbeTimeoutMs(value: unknown): number {
  return Math.max(1000, Math.trunc(readNumber(value) ?? DEFAULT_CLAUDE_EXECUTION_PROBE_TIMEOUT_MS));
}

export function resolveClaudeRequestTimeoutMs(value: unknown): number | undefined {
  const timeoutMs = readNumber(value);
  if (typeof timeoutMs !== "number") {
    return undefined;
  }
  return Math.max(0, Math.trunc(timeoutMs));
}

export function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const values = value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return values.length > 0 ? values : undefined;
}

export function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      continue;
    }
    const normalized = entryValue.trim();
    if (!normalized) {
      continue;
    }
    out[entryKey] = normalized;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function readStringOrNullRecord(value: unknown): Record<string, string | null> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, string | null> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue === "string") {
      out[entryKey] = entryValue.trim();
      continue;
    }
    if (entryValue === null) {
      out[entryKey] = null;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeClaudeModel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("/")) {
    return trimmed;
  }
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? trimmed;
}

export function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = readString(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}
