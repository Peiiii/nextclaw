import { SessionMessageSqlProjectionStore, sessionJsonChunks, type SqliteDatabase } from "@nextclaw/kernel";

const tables = ["projection_meta", "messages", "tool_owners", "messages_identity", "messages_source", "messages_page", "messages_ingress", "messages_pending_compaction", "part_fields", "part_chunks", "part_previews",
  "staged_fields", "staged_chunks", "part_fields_order", "settled_tools", "session_questions", "session_questions_pending",
  "session_interruptions", "session_interruptions_run", "interruption_fields", "interruption_chunks", "settled_tools_owner"];

/** Only the SQL/transaction boundary varies; projection and cursor semantics stay in Kernel. */
export class CloudflareSessionSqlStore {
  readonly projection: SessionMessageSqlProjectionStore;
  private readonly prefixes = new Map<string, Promise<string>>();

  constructor(private readonly storage: DurableObjectStorage, private readonly bytes: (id: string) => Promise<number | null>, identity: (id: string) => Promise<string | null>) {
    if (!storage.sql) throw new Error("Bibo session storage requires a SQLite Durable Object.");
    storage.sql.exec(`CREATE TABLE IF NOT EXISTS session_journal (
      session_id TEXT NOT NULL, seq INTEGER NOT NULL, chunk INTEGER NOT NULL,
      start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL, content TEXT NOT NULL,
      PRIMARY KEY(session_id,seq,chunk));
      CREATE INDEX IF NOT EXISTS session_journal_offset ON session_journal(session_id,start_offset);`);
    this.projection = new SessionMessageSqlProjectionStore({
      database: async (id, create) => {
        const prefix = await this.prefix(id);
        if (!create && !storage.sql.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", `${prefix}projection_meta`).toArray().length) return null;
        return this.database(prefix);
      },
      journalBytes: bytes,
      journalIdentity: identity,
      delete: async id => this.dropProjection(id),
      transaction: operation => storage.transaction(async () => operation()),
    });
  }

  private prefix = (id: string): Promise<string> => {
    let pending = this.prefixes.get(id);
    if (!pending) {
      pending = crypto.subtle.digest("SHA-256", new TextEncoder().encode(id)).then(hash =>
        `s_${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")}_`);
      if (this.prefixes.size >= 128) this.prefixes.delete(this.prefixes.keys().next().value!);
      this.prefixes.set(id, pending);
    }
    return pending;
  };

  private database = (prefix: string): SqliteDatabase => {
    const sql = (source: string) => source.replace(new RegExp(`\\b(${tables.join("|")})\\b`, "g"), name => `${prefix}${name}`);
    return {
      close: () => {},
      // DO input gates hold timers until the transaction ends. Awaiting a timer here deadlocks it.
      transactionYield: () => Promise.resolve(),
      // All mutation callers use storage.transaction; DO SQLite prohibits SQL BEGIN/COMMIT.
      exec: source => { if (!/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(source.trim())) this.storage.sql.exec(sql(source)); },
      prepare: source => ({
        all: (...params) => this.storage.sql.exec(sql(source), ...params as SqlStorageValue[]).toArray(),
        get: (...params) => this.storage.sql.exec(sql(source), ...params as SqlStorageValue[]).toArray()[0],
        run: (...params) => this.storage.sql.exec(sql(source), ...params as SqlStorageValue[]).rowsWritten,
      }),
    };
  };

  append = (id: string, sequence: number, startOffset: number, entry: unknown): number => {
    let offset = startOffset;
    let ordinal = 0;
    for (const content of sessionJsonChunks(entry)) {
      const end = offset + Buffer.byteLength(content);
      this.storage.sql.exec("INSERT INTO session_journal VALUES (?,?,?,?,?,?)", id, sequence, ordinal++, offset, end, content);
      offset = end;
    }
    this.storage.sql.exec("INSERT INTO session_journal VALUES (?,?,?,?,?,?)", id, sequence, ordinal, offset, offset + 1, "\n");
    return offset + 1;
  };

  appendFragments = async (id: string, sequence: number, startOffset: number, fragments: AsyncIterable<string>): Promise<number> => {
    let offset = startOffset;
    let ordinal = 0;
    let carry = "";
    const write = (content: string) => {
      const end = offset + Buffer.byteLength(content);
      this.storage.sql.exec("INSERT INTO session_journal VALUES (?,?,?,?,?,?)", id, sequence, ordinal++, offset, end, content);
      offset = end;
    };
    for await (const value of fragments) {
      const text = carry + value;
      carry = /[\uD800-\uDBFF]$/.test(text) ? text.slice(-1) : "";
      const end = text.length - carry.length;
      for (let start = 0; start < end;) {
        let boundary = Math.min(end, start + 4_096);
        if (boundary < end && /[\uD800-\uDBFF]/.test(text[boundary - 1]!)) boundary -= 1;
        write(text.slice(start, boundary)); start = boundary;
      }
    }
    if (carry) throw new Error("Legacy session source ends inside a Unicode character.");
    return offset;
  };

  source = async function* (this: CloudflareSessionSqlStore, id: string, offset: number): AsyncGenerator<string> {
    for (;;) {
      const rows = this.storage.sql.exec<{ start_offset: number; end_offset: number; content: string }>(
        "SELECT start_offset,end_offset,content FROM session_journal WHERE session_id=? AND start_offset>=? ORDER BY start_offset LIMIT 16", id, offset).toArray();
      if (!rows.length) return;
      for (const row of rows) {
        if (row.start_offset !== offset) throw new Error("Session source has a missing fragment.");
        yield row.content; offset = row.end_offset;
      }
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  };

  dropProjection = async (id: string): Promise<void> => {
    const prefix = await this.prefix(id);
    for (const table of tables.filter(name => !["messages_identity", "messages_source", "messages_page", "messages_ingress", "messages_pending_compaction", "part_fields_order", "session_questions_pending", "session_interruptions_run", "settled_tools_owner"].includes(name))) {
      this.storage.sql.exec(`DROP TABLE IF EXISTS ${prefix}${table}`);
    }
  };

  delete = async (id: string): Promise<void> => {
    await this.dropProjection(id);
    this.storage.sql.exec("DELETE FROM session_journal WHERE session_id=?", id);
  };
}
