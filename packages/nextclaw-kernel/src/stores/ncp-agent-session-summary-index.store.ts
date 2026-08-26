import Database from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { NcpEventType, type NcpMessage, type NcpSessionSummary } from "@nextclaw/ncp";
import {
  type LoadedNcpAgentJournalSession,
  type NcpAgentSessionJournalReplayEvent,
  normalizeNcpSessionId,
  upsertNcpAgentSessionSummaryEvent,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import {
  scanNcpAgentSessionCatalogJournals,
  type CatalogLegacyScanResult,
} from "./ncp-agent-session-catalog-migration.store.js";

const SQLITE_DATABASE_FILE = ".ncp-agent-session-catalog.sqlite";
const CATALOG_SCHEMA_VERSION = 1;
const MIGRATION_STATUS_KEY = "migration_status";
const MIGRATION_COMPLETE = "complete";

type SessionCatalogRow = {
  session_id: string;
  peer_id: string | null;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  message_count: number;
  status: string;
  metadata_json: string;
  deleted_at: string | null;
};

function readEventMessage(event: NcpAgentSessionJournalReplayEvent): NcpMessage | undefined {
  if (
    event.type === NcpEventType.MessageSent ||
    event.type === NcpEventType.MessageCompleted ||
    event.type === "session.snapshot.message"
  ) {
    return event.payload.message;
  }
  return undefined;
}

function summaryToRow(summary: NcpSessionSummary, deletedAt: string | null = null) {
  const updatedAt = summary.updatedAt || summary.createdAt || new Date().toISOString();
  return {
    session_id: summary.sessionId,
    peer_id: summary.peerId ?? null,
    agent_id: summary.agentId ?? null,
    created_at: summary.createdAt ?? updatedAt,
    updated_at: updatedAt,
    last_message_at: summary.lastMessageAt ?? null,
    message_count: Math.max(0, summary.messageCount ?? 0),
    status: summary.status || "idle",
    metadata_json: JSON.stringify(summary.metadata ?? {}),
    deleted_at: deletedAt,
  };
}

function rowToSummary(row: SessionCatalogRow): NcpSessionSummary {
  return {
    sessionId: row.session_id,
    ...(row.peer_id ? { peerId: row.peer_id } : {}),
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    messageCount: row.message_count,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    updatedAt: row.updated_at,
    ...(row.last_message_at ? { lastMessageAt: row.last_message_at } : {}),
    status: row.status as NcpSessionSummary["status"],
  };
}

export class NcpAgentSessionSummaryIndexStore {
  private database: Database.Database | null = null;
  private readyPromise: Promise<void> | null = null;

  constructor(
    private readonly journalDir: string,
    private readonly loadSession: (sessionId: string) => Promise<LoadedNcpAgentJournalSession | null>,
    private readonly loadSessionSummary?: (sessionId: string) => Promise<NcpSessionSummary | null>,
  ) {}

  has = async (sessionId: string): Promise<boolean> => {
    await this.ensureReady();
    const row = this.db().prepare(
      "SELECT 1 AS present FROM sessions WHERE session_id = ? AND deleted_at IS NULL LIMIT 1",
    ).get(normalizeNcpSessionId(sessionId)) as { present: number } | undefined;
    return Boolean(row?.present);
  };

  get = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    await this.ensureReady();
    const row = this.db().prepare(
      "SELECT * FROM sessions WHERE session_id = ? AND deleted_at IS NULL LIMIT 1",
    ).get(normalizeNcpSessionId(sessionId)) as SessionCatalogRow | undefined;
    return row ? structuredClone(rowToSummary(row)) : null;
  };

  list = async (limit?: number): Promise<NcpSessionSummary[]> => {
    await this.ensureReady();
    const query = `SELECT * FROM sessions
      WHERE deleted_at IS NULL
      ORDER BY COALESCE(last_message_at, created_at, updated_at) DESC, session_id DESC`;
    const rows = limit === undefined
      ? this.db().prepare(query).all() as SessionCatalogRow[]
      : this.db().prepare(`${query} LIMIT ?`).all(limit) as SessionCatalogRow[];
    return rows.map((row) => structuredClone(rowToSummary(row)));
  };

  upsert = async (summary: NcpSessionSummary): Promise<void> => {
    await this.ensureReady();
    this.writeSummary(summaryToRow(summary), true);
  };

  upsertForEvent = async (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
    updatedAt: string;
  }): Promise<void> => {
    await this.ensureReady();
    const sessionId = normalizeNcpSessionId(params.sessionId);
    const currentRow = this.db().prepare(
      "SELECT * FROM sessions WHERE session_id = ? LIMIT 1",
    ).get(sessionId) as SessionCatalogRow | undefined;
    const current = currentRow && currentRow.deleted_at === null
      ? rowToSummary(currentRow)
      : undefined;
    const summary = upsertNcpAgentSessionSummaryEvent({
      current,
      sessionId,
      event: params.event,
      updatedAt: params.updatedAt,
    });
    const row = summaryToRow({
      ...summary,
      messageCount: readEventMessage(params.event) ? 1 : 0,
    });
    this.db().prepare(
      `INSERT INTO sessions (
         session_id, peer_id, agent_id, created_at, updated_at,
         last_message_at, message_count, status, metadata_json, deleted_at
       ) VALUES (
         @session_id, @peer_id, @agent_id, @created_at, @updated_at,
         @last_message_at, @message_count, @status, @metadata_json, NULL
       )
       ON CONFLICT(session_id) DO UPDATE SET
         peer_id = COALESCE(sessions.peer_id, excluded.peer_id),
         agent_id = COALESCE(sessions.agent_id, excluded.agent_id),
         created_at = MIN(sessions.created_at, excluded.created_at),
         updated_at = MAX(sessions.updated_at, excluded.updated_at),
         last_message_at = CASE
           WHEN sessions.last_message_at IS NULL THEN excluded.last_message_at
           WHEN excluded.last_message_at IS NULL THEN sessions.last_message_at
           WHEN excluded.last_message_at > sessions.last_message_at THEN excluded.last_message_at
           ELSE sessions.last_message_at
         END,
         message_count = sessions.message_count + excluded.message_count,
         status = excluded.status
       WHERE sessions.deleted_at IS NULL`,
    ).run(row);
  };

  remove = async (sessionId: string): Promise<void> => {
    await this.ensureReady();
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    const deletedAt = new Date().toISOString();
    const transaction = this.db().transaction(() => {
      const existing = this.db().prepare(
        "SELECT session_id FROM sessions WHERE session_id = ? LIMIT 1",
      ).get(normalizedSessionId) as { session_id: string } | undefined;
      if (existing) {
        this.db().prepare("UPDATE sessions SET deleted_at = ? WHERE session_id = ?")
          .run(deletedAt, normalizedSessionId);
        return;
      }
      this.db().prepare(
        `INSERT INTO sessions (
           session_id, created_at, updated_at, message_count,
           status, metadata_json, deleted_at
         ) VALUES (?, ?, ?, 0, 'idle', '{}', ?)`,
      ).run(normalizedSessionId, deletedAt, deletedAt, deletedAt);
    });
    transaction();
  };

  close = (): void => {
    this.database?.close();
    this.database = null;
    this.readyPromise = null;
  };

  initialize = async (): Promise<void> => {
    await this.ensureReady();
  };

  private ensureReady = async (): Promise<void> => {
    if (!this.readyPromise) {
      this.readyPromise = this.initializeCatalog();
    }
    await this.readyPromise;
  };

  private initializeCatalog = async (): Promise<void> => {
    await mkdir(this.journalDir, { recursive: true });
    this.database = new Database(resolve(this.journalDir, SQLITE_DATABASE_FILE), { timeout: 10000 });
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("synchronous = NORMAL");
    this.database.pragma("foreign_keys = ON");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        peer_id TEXT,
        agent_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_message_at TEXT,
        message_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        deleted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS storage_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS migration_diagnostics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        kind TEXT NOT NULL,
        detail_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_activity_idx
      ON sessions (deleted_at, last_message_at, created_at, updated_at);
    `);

    const migrationStatus = this.database.prepare(
      "SELECT value FROM storage_meta WHERE key = ? LIMIT 1",
    ).get(MIGRATION_STATUS_KEY) as { value: string } | undefined;
    if (migrationStatus?.value === MIGRATION_COMPLETE) {
      return;
    }

    const scan = await scanNcpAgentSessionCatalogJournals({
      journalDir: this.journalDir,
      loadSession: (sessionId) => this.loadSession(sessionId),
      loadSessionSummary: this.loadSessionSummary,
    });
    const transaction = this.db().transaction((result: CatalogLegacyScanResult) => {
      const status = this.db().prepare(
        "SELECT value FROM storage_meta WHERE key = ? LIMIT 1",
      ).get(MIGRATION_STATUS_KEY) as { value: string } | undefined;
      if (status?.value === MIGRATION_COMPLETE) {
        this.reconcileRecords(result.records);
        return;
      }
      for (const record of result.records) {
        const existing = this.db().prepare(
          "SELECT deleted_at FROM sessions WHERE session_id = ? LIMIT 1",
        ).get(record.sessionId) as { deleted_at: string | null } | undefined;
        if (existing?.deleted_at) {
          continue;
        }
        this.writeSummary(summaryToRow(record), false);
      }
      for (const diagnostic of result.diagnostics) {
        this.db().prepare(
          `INSERT INTO migration_diagnostics (session_id, kind, detail_json, created_at)
           VALUES (?, ?, ?, ?)`,
        ).run(
          diagnostic.sessionId ?? null,
          diagnostic.kind,
          JSON.stringify(diagnostic.detail),
          new Date().toISOString(),
        );
      }
      this.db().prepare(
        `INSERT INTO storage_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(MIGRATION_STATUS_KEY, MIGRATION_COMPLETE);
      this.db().prepare(
        `INSERT INTO storage_meta (key, value) VALUES ('schema_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(String(CATALOG_SCHEMA_VERSION));
    });
    transaction.immediate(scan);
  };

  private reconcileRecords = (records: NcpSessionSummary[]): void => {
    for (const record of records) {
      const existing = this.db().prepare(
        "SELECT deleted_at FROM sessions WHERE session_id = ? LIMIT 1",
      ).get(record.sessionId) as { deleted_at: string | null } | undefined;
      if (!existing?.deleted_at) {
        this.writeSummary(summaryToRow(record), false);
      }
    }
  };

  private writeSummary = (
    row: ReturnType<typeof summaryToRow>,
    restoreDeleted: boolean,
  ): void => {
    this.db().prepare(
      `INSERT INTO sessions (
         session_id, peer_id, agent_id, created_at, updated_at,
         last_message_at, message_count, status, metadata_json, deleted_at
       ) VALUES (
         @session_id, @peer_id, @agent_id, @created_at, @updated_at,
         @last_message_at, @message_count, @status, @metadata_json, @deleted_at
       )
       ON CONFLICT(session_id) DO UPDATE SET
         peer_id = excluded.peer_id,
         agent_id = excluded.agent_id,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         last_message_at = excluded.last_message_at,
         message_count = excluded.message_count,
         status = excluded.status,
         metadata_json = excluded.metadata_json,
         deleted_at = CASE
           WHEN @restore_deleted = 1 THEN NULL
           ELSE sessions.deleted_at
         END`,
    ).run({ ...row, restore_deleted: restoreDeleted ? 1 : 0 });
  };

  private db = (): Database.Database => {
    if (!this.database) {
      throw new Error("NCP session catalog database is not initialized.");
    }
    return this.database;
  };
}
