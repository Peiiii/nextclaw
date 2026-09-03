import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import {
  applyNcpAgentRunLifecycleEvent,
  isNcpAgentRunLifecycleEvent,
  type UnfinishedNcpAgentRun,
} from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import type { SqliteDatabase } from "./sqlite-database.store.js";

export type NcpAgentRunRecoveryCheckpoint = {
  sessionId: string;
  journalOffset: number | null;
  activeRun: UnfinishedNcpAgentRun | null;
};

export class NcpAgentRunRecoveryIndexStore {
  constructor(
    private readonly db: () => SqliteDatabase,
    private readonly ensureReady: () => Promise<void>,
  ) {}

  initializeSchema = (): void => {
    this.db().exec(`
      CREATE TABLE IF NOT EXISTS run_recovery (
        session_id TEXT PRIMARY KEY,
        journal_offset INTEGER NOT NULL,
        active_run_json TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );
    `);
  };

  list = async (): Promise<NcpAgentRunRecoveryCheckpoint[]> => {
    await this.ensureReady();
    const rows = this.db().prepare(`
      SELECT sessions.session_id, run_recovery.journal_offset, run_recovery.active_run_json
      FROM sessions
      LEFT JOIN run_recovery ON run_recovery.session_id = sessions.session_id
      WHERE sessions.deleted_at IS NULL
    `).all() as Array<{
      session_id: string;
      journal_offset: number | null;
      active_run_json: string | null;
    }>;
    return rows.map((row) => ({
      sessionId: row.session_id,
      journalOffset: row.journal_offset,
      activeRun: parseUnfinishedRun(row.active_run_json),
    }));
  };

  write = async (checkpoint: {
    sessionId: string;
    journalOffset: number;
    activeRun: UnfinishedNcpAgentRun | null;
  }): Promise<void> => {
    await this.ensureReady();
    this.db().prepare(`
      INSERT INTO run_recovery (session_id, journal_offset, active_run_json)
      VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        journal_offset = excluded.journal_offset,
        active_run_json = excluded.active_run_json
    `).run(
      checkpoint.sessionId,
      checkpoint.journalOffset,
      checkpoint.activeRun ? JSON.stringify(checkpoint.activeRun) : null,
    );
  };

  recordEvent = async (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
    journalOffset: number;
  }): Promise<void> => {
    const { event, journalOffset, sessionId } = params;
    if (!isNcpAgentRunLifecycleEvent(event)) return;
    await this.ensureReady();
    const row = this.db().prepare(`
      SELECT active_run_json FROM run_recovery WHERE session_id = ? LIMIT 1
    `).get(sessionId) as { active_run_json: string | null } | undefined;
    await this.write({
      sessionId,
      journalOffset,
      activeRun: applyNcpAgentRunLifecycleEvent(
        sessionId,
        parseUnfinishedRun(row?.active_run_json ?? null),
        event,
      ),
    });
  };
}

function parseUnfinishedRun(value: string | null): UnfinishedNcpAgentRun | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<UnfinishedNcpAgentRun>;
    if (!parsed || typeof parsed.sessionId !== "string") return null;
    return {
      sessionId: parsed.sessionId,
      ...(typeof parsed.messageId === "string" ? { messageId: parsed.messageId } : {}),
      ...(typeof parsed.runId === "string" ? { runId: parsed.runId } : {}),
      ...(typeof parsed.startedAt === "string" ? { startedAt: parsed.startedAt } : {}),
    };
  } catch {
    return null;
  }
}
