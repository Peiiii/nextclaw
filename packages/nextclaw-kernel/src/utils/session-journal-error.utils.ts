export const SESSION_JOURNAL_FAILURE_SOURCE = "session-event-coordinator:journal-failure";
export const SESSION_JOURNAL_WRITE_FAILED = "SESSION_JOURNAL_WRITE_FAILED";

export class SessionJournalWriteError extends Error {
  readonly code = SESSION_JOURNAL_WRITE_FAILED;

  constructor(sessionId: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
    super(`Session journal write failed for ${sessionId}; refusing further writes until recovery. ` +
      `The run was stopped to prevent unsaved work. Check storage access and restart NextClaw before retrying. Cause: ${code} ${detail}`, { cause });
    this.name = "SessionJournalWriteError";
  }
}

export function isSessionJournalWriteError(error: unknown): error is SessionJournalWriteError {
  return error instanceof Error && "code" in error && error.code === SESSION_JOURNAL_WRITE_FAILED;
}

/** Keep filesystem/JSON diagnostics without logging the failed user event or provider configuration. */
export function formatSessionJournalError(error: unknown): string {
  const causes: Array<Record<string, unknown>> = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current !== undefined && causes.length < 8 && !seen.has(current)) {
    seen.add(current);
    if (!current || typeof current !== "object") { causes.push({ message: String(current).slice(0, 2048) }); break; }
    const record = current as Record<string, unknown>;
    const detail: Record<string, unknown> = {};
    for (const key of ["name", "message", "code", "errno", "syscall", "path", "stack"]) {
      const value = record[key];
      if (typeof value === "string") detail[key] = value.slice(0, key === "stack" ? 8192 : 2048);
      else if (typeof value === "number") detail[key] = value;
    }
    causes.push(detail);
    current = record.cause;
  }
  return JSON.stringify(causes);
}
