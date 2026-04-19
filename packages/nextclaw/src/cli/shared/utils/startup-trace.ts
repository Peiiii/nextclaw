const STARTUP_TRACE_ENABLED = process.env.NEXTCLAW_STARTUP_TRACE === "1";
const STARTUP_TRACE_ORIGIN_MS = Date.now();

type TraceFields = Record<string, string | number | boolean | null | undefined>;

function formatFields(fields: TraceFields | undefined): string {
  if (!fields) {
    return "";
  }
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function logStartupTrace(step: string, fields?: TraceFields): void {
  if (!STARTUP_TRACE_ENABLED) {
    return;
  }
  const elapsedMs = Date.now() - STARTUP_TRACE_ORIGIN_MS;
  console.log(`[startup-trace] +${elapsedMs}ms ${step}${formatFields(fields)}`);
}

export function measureStartupSync<T>(step: string, fn: () => T, fields?: TraceFields): T {
  const startedAt = Date.now();
  try {
    return fn();
  } finally {
    logStartupTrace(step, {
      ...fields,
      duration_ms: Date.now() - startedAt,
    });
  }
}

export async function measureStartupAsync<T>(step: string, fn: () => Promise<T>, fields?: TraceFields): Promise<T> {
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    logStartupTrace(step, {
      ...fields,
      duration_ms: Date.now() - startedAt,
    });
  }
}
