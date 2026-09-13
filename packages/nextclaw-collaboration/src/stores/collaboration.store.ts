import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ContextState } from "../types/collaboration.types.js";

/** One small transactional journal. All durable lifecycle state has this owner. */
export class CollaborationStore {
  putContext = (context: ContextState): void => {
    const { key, status } = context;
    const previous = this.get<ContextState>("context", key);
    if (previous?.status !== status)
      context.statusVersion = (previous?.statusVersion || 0) + 1;
    this.put("context", key, context);
  };
  private readonly db: DatabaseSync;
  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS lease (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires INTEGER NOT NULL)",
    );
  }
  get = <T>(kind: string, id: string): T | undefined => {
    const row = this.db
      .prepare("SELECT value FROM records WHERE kind=? AND id=?")
      .get(kind, id) as
      | {
          value: string;
        }
      | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
  };
  list = <T>(kind: string): T[] => {
    return (
      this.db
        .prepare("SELECT value FROM records WHERE kind=? ORDER BY rowid")
        .all(kind) as Array<{
        value: string;
      }>
    ).map((row) => JSON.parse(row.value) as T);
  };
  put = (kind: string, id: string, value: unknown): void => {
    this.db
      .prepare(
        "INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
      )
      .run(kind, id, JSON.stringify(value));
  };
  remove = (kind: string, id: string): void => {
    this.db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind, id);
  };
  transaction = <T>(operation: () => T): T => {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  };
  lease = (owner: string, now = Date.now()): boolean => {
    return this.transaction(() => {
      const lease = this.db
        .prepare("SELECT owner,expires FROM lease WHERE id=1")
        .get() as
        | {
            owner: string;
            expires: number;
          }
        | undefined;
      if (lease && lease.owner !== owner && lease.expires > now) return false;
      this.db
        .prepare(
          "INSERT INTO lease VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires",
        )
        .run(owner, now + 60000);
      return true;
    });
  };
  release = (owner: string): void => {
    this.db.prepare("DELETE FROM lease WHERE owner=?").run(owner);
  };
  compact = (days = 30): void => {
    if (!Number.isSafeInteger(days) || days < 1)
      throw new Error("Retention must be at least one day");
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE records SET value=json_set(value,'$.event.data.body','') WHERE kind='event' AND json_extract(value,'$.state') IN ('done','ignored') AND json_extract(value,'$.receivedAt') < ?",
        )
        .run(cutoff);
      this.db
        .prepare(
          "UPDATE records SET value=json_remove(value,'$.text') WHERE kind='run' AND json_extract(value,'$.state') IN ('completed','cancelled') AND json_extract(value,'$.createdAt') < ?",
        )
        .run(cutoff);
      this.db.exec(
        "UPDATE records SET value=json_set(value,'$.operation.body','') WHERE kind='outbox' AND json_extract(value,'$.state')='sent'",
      );
    });
  };
  close = (): void => {
    this.db.close();
  };
}
