export const SESSION_JOURNAL_FAILURE_SOURCE = "session-event-coordinator:journal-failure";
export const SESSION_JOURNAL_WRITE_FAILED = "SESSION_JOURNAL_WRITE_FAILED";

export class SessionJournalWriteError extends Error {
  readonly code = SESSION_JOURNAL_WRITE_FAILED;

  constructor(sessionId: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
    super(`Session journal write failed for ${sessionId}; refusing further writes until recovery. ` +
      `The run was stopped to prevent unsaved work. Check storage access, then send again to recover this session. Pending inputs are retained while NextClaw stays open. Cause: ${code} ${detail}`, { cause });
    this.name = "SessionJournalWriteError";
  }
}

export function isSessionJournalWriteError(error: unknown): error is SessionJournalWriteError {
  return error instanceof Error && "code" in error && error.code === SESSION_JOURNAL_WRITE_FAILED;
}

/** Read only the transaction's scalar diagnostics; never copy the failed event. */
export function readSessionJournalFailureContext(error: unknown): Record<string, string | number | boolean> {
  const seen = new Set<unknown>();
  let current = error;
  for (let depth = 0; current && typeof current === "object" && depth < 8 && !seen.has(current); depth++) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    const context = record.sessionPersistence;
    if (context && typeof context === "object") {
      const detail: Record<string, string | number | boolean> = {};
      for (const key of ["operation", "stage", "path", "seq", "previousOffset", "journalOffset", "rollback", "journalCommitted", "metadataCommitted"]) {
        const value = (context as Record<string, unknown>)[key];
        if (typeof value === "string") detail[key] = value.slice(0, 2048);
        else if (typeof value === "number" || typeof value === "boolean") detail[key] = value;
      }
      return detail;
    }
    current = record.cause;
  }
  return {};
}
