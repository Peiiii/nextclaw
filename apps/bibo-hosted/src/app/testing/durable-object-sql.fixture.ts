import { DatabaseSync, type SQLInputValue } from "node:sqlite";

/** Real SQLite with a KV fake: roll both stores back at the same transaction boundary. */
export function attachDurableObjectSql<T extends { transaction: unknown }>(storage: T): T {
  if ("sql" in storage) return storage;
  const database = new DatabaseSync(":memory:");
  const sql = { exec: (query: string, ...params: SQLInputValue[]) => {
    let rows: unknown[] = [];
    if (/^\s*(CREATE|DROP|PRAGMA)\b/i.test(query) || (!params.length && query.trim().replace(/;$/, "").includes(";"))) database.exec(query);
    else rows = database.prepare(query).all(...params);
    return { toArray: () => rows, [Symbol.iterator]: () => rows[Symbol.iterator](), rowsRead: rows.length, rowsWritten: 0 };
  } };
  type Operation<R> = (transaction: unknown) => Promise<R>;
  const original = (storage.transaction as <R>(operation: Operation<R>) => Promise<R>).bind(storage);
  let queue = Promise.resolve();
  const transaction = <R>(operation: Operation<R>): Promise<R> => {
    const result = queue.then(async () => {
      database.exec("BEGIN");
      try { const value = await original(operation); database.exec("COMMIT"); return value; }
      catch (error) { database.exec("ROLLBACK"); throw error; }
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  Object.assign(storage, { sql, transaction });
  return storage;
}
