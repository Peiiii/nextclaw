import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import type { D1Database, D1PreparedStatement } from "../portal-env.types.js";

/** Local acceptance host for the same SQL repository used by D1. */
export class SupportLocalDatabaseService implements D1Database {
  private readonly database: DatabaseSync;
  constructor(path: string, migrations: URL) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS portal_migrations (name TEXT PRIMARY KEY)");
    for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
      if (this.database.prepare("SELECT name FROM portal_migrations WHERE name=?").get(name)) continue;
      this.database.exec("BEGIN");
      try {
        this.database.exec(readFileSync(new URL(name, migrations), "utf8"));
        this.database.prepare("INSERT INTO portal_migrations(name) VALUES (?)").run(name);
        this.database.exec("COMMIT");
      } catch (error) { this.database.exec("ROLLBACK"); throw error; }
    }
  }
  prepare = (query: string): D1PreparedStatement => {
    const statement = this.database.prepare(query);
    let values: SQLInputValue[] = [];
    const prepared: D1PreparedStatement = {
      bind: (...args) => { values = args; return prepared; },
      run: async () => { const result = statement.run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] })
    };
    return prepared;
  };
  close = (): void => { this.database.close(); };
}
