import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Database, SqlJsStatic, Statement } from "sql.js";

export type SessionCatalogSqliteStatement = {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown;
  run: (...params: unknown[]) => unknown;
};

export type SessionCatalogSqliteDatabase = {
  close: () => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => SessionCatalogSqliteStatement;
};

const require = createRequire(import.meta.url);
const portableDatabases = new Map<
  string,
  Promise<PortableSessionCatalogSqliteDatabase>
>();

export async function openSessionCatalogSqliteDatabase(
  databasePath: string,
): Promise<SessionCatalogSqliteDatabase> {
  try {
    const native = require("node:sqlite") as {
      DatabaseSync: new (path: string) => SessionCatalogSqliteDatabase;
    };
    return new native.DatabaseSync(databasePath);
  } catch (error) {
    if (!isMissingNodeSqlite(error)) throw error;
    return await openPortableDatabase(databasePath);
  }
}

export function runSessionCatalogSqliteTransaction<T>(
  database: SessionCatalogSqliteDatabase,
  operation: () => T,
  mode: "DEFERRED" | "IMMEDIATE" = "DEFERRED",
): T {
  database.exec(`BEGIN ${mode}`);
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function isMissingNodeSqlite(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  return code === "ERR_UNKNOWN_BUILTIN_MODULE" || code === "MODULE_NOT_FOUND";
}

async function openPortableDatabase(
  databasePath: string,
): Promise<SessionCatalogSqliteDatabase> {
  const existing = portableDatabases.get(databasePath);
  if (existing) return (await existing).acquire();
  const opening = createPortableDatabase(databasePath).catch((error) => {
    portableDatabases.delete(databasePath);
    throw error;
  });
  portableDatabases.set(databasePath, opening);
  return (await opening).acquire();
}

async function createPortableDatabase(
  databasePath: string,
): Promise<PortableSessionCatalogSqliteDatabase> {
  const imported = await import("sql.js");
  const initialize = imported.default as unknown as (params: {
    locateFile: (file: string) => string;
  }) => Promise<SqlJsStatic>;
  const sqlite = await initialize({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  const database = existsSync(databasePath)
    ? new sqlite.Database(readFileSync(databasePath))
    : new sqlite.Database();
  return new PortableSessionCatalogSqliteDatabase(databasePath, database);
}

class PortableSessionCatalogSqliteDatabase {
  private inTransaction = false;
  private dirty = false;
  private leaseCount = 0;

  constructor(
    private readonly databasePath: string,
    private readonly database: Database,
  ) {}

  acquire = (): SessionCatalogSqliteDatabase => {
    this.leaseCount += 1;
    return new PortableSessionCatalogSqliteLease(this);
  };

  exec = (sql: string): void => {
    const command = sql.trim().toUpperCase();
    this.database.run(sql);
    if (command.startsWith("BEGIN")) {
      this.inTransaction = true;
      return;
    }
    if (command.startsWith("ROLLBACK")) {
      this.inTransaction = false;
      this.dirty = false;
      return;
    }
    if (command.startsWith("COMMIT")) {
      this.inTransaction = false;
      this.persistIfDirty();
      return;
    }
    if (!command.startsWith("PRAGMA")) this.markDirty();
  };

  prepare = (sql: string): SessionCatalogSqliteStatement =>
    new PortableSessionCatalogSqliteStatement(this, sql);

  release = (): void => {
    this.leaseCount -= 1;
    if (this.leaseCount > 0) return;
    this.persistIfDirty();
    this.database.close();
    portableDatabases.delete(this.databasePath);
  };

  run = (sql: string, params: unknown[]): void => {
    this.database.run(
      sql,
      normalizeParams(params) as Parameters<Database["run"]>[1],
    );
    this.markDirty();
  };

  readRows = (sql: string, params: unknown[]): unknown[] => {
    const statement = this.database.prepare(sql);
    try {
      bindStatement(statement, params);
      const rows: unknown[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  };

  private markDirty = (): void => {
    this.dirty = true;
    if (!this.inTransaction) this.persistIfDirty();
  };

  private persistIfDirty = (): void => {
    if (!this.dirty) return;
    const temporaryPath = `${this.databasePath}.tmp`;
    writeFileSync(temporaryPath, this.database.export());
    renameSync(temporaryPath, this.databasePath);
    this.dirty = false;
  };
}

class PortableSessionCatalogSqliteLease implements SessionCatalogSqliteDatabase {
  private closed = false;

  constructor(private readonly owner: PortableSessionCatalogSqliteDatabase) {}

  close = (): void => {
    if (this.closed) return;
    this.closed = true;
    this.owner.release();
  };

  exec = (sql: string): void => this.owner.exec(sql);

  prepare = (sql: string): SessionCatalogSqliteStatement =>
    this.owner.prepare(sql);
}

class PortableSessionCatalogSqliteStatement implements SessionCatalogSqliteStatement {
  constructor(
    private readonly database: PortableSessionCatalogSqliteDatabase,
    private readonly sql: string,
  ) {}

  all = (...params: unknown[]): unknown[] =>
    this.database.readRows(this.sql, params);

  get = (...params: unknown[]): unknown => this.all(...params)[0];

  run = (...params: unknown[]): unknown => {
    this.database.run(this.sql, params);
    return {};
  };
}

function bindStatement(statement: Statement, params: unknown[]): void {
  const normalized = normalizeParams(params);
  if (Array.isArray(normalized) && normalized.length === 0) return;
  statement.bind(normalized as Parameters<Statement["bind"]>[0]);
}

function normalizeParams(
  params: unknown[],
): unknown[] | Record<string, unknown> {
  if (params.length !== 1 || !isRecord(params[0])) return params;
  return Object.fromEntries(
    Object.entries(params[0]).map(([key, value]) => [`@${key}`, value]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
