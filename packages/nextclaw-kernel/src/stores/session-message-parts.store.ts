import type { NcpMessage } from "@nextclaw/ncp";
import { sessionJsonChunks } from "@kernel/utils/session-message-chunks.utils.js";
import type { SessionJsonToken } from "@kernel/utils/session-journal-stream.utils.js";
import type { SqliteDatabase } from "./sqlite-database.store.js";

type FieldRow = { field: string; field_order: number; kind: "string" | "json"; bytes: number };
type Capture = { path: readonly string[]; source: string; part: number; field: string; kind: "string" | "json"; chunk: number; pending: string; bytes: number; containers: { kind: "object" | "array"; count: number }[] };
const FIELD_ORDER: Record<string, number> = { type: 0, text: 1, toolCallId: 2, toolName: 3, state: 4, args: 5, result: 6, resultContentItems: 7, execution: 8 };
export type PartFragmentPosition = { field: number; chunk: number };

/** Field storage isolates large bodies from replay state; it owns no message semantics. */
export class SessionMessagePartsStore {
  private capture: Capture | undefined;
  omitSmallDeltaStaging = false;
  private hasStagedRows = true;
  constructor(private readonly database: SqliteDatabase) {}

  initialize = (): void => {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS part_fields(message_id TEXT,part INTEGER,field TEXT,field_order INTEGER,kind TEXT,bytes INTEGER,PRIMARY KEY(message_id,part,field)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS part_chunks(message_id TEXT,part INTEGER,field TEXT,chunk INTEGER,body TEXT,PRIMARY KEY(message_id,part,field,chunk)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS part_previews(message_id TEXT,part INTEGER,body TEXT,PRIMARY KEY(message_id,part)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS staged_fields(source TEXT,part INTEGER,field TEXT,field_order INTEGER,kind TEXT,bytes INTEGER,PRIMARY KEY(source,part,field)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS staged_chunks(source TEXT,part INTEGER,field TEXT,chunk INTEGER,body TEXT,PRIMARY KEY(source,part,field,chunk)) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS part_fields_order ON part_fields(message_id,part,field_order);
      CREATE TABLE IF NOT EXISTS settled_tools(call_id TEXT PRIMARY KEY,message_id TEXT,part INTEGER) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS settled_tools_owner ON settled_tools(message_id,part);
      CREATE TABLE IF NOT EXISTS session_questions(id TEXT PRIMARY KEY,message_id TEXT,resolution_id TEXT,asked_at TEXT) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS session_questions_pending ON session_questions(resolution_id,asked_at,id);
      CREATE TABLE IF NOT EXISTS session_interruptions(message_id TEXT PRIMARY KEY,run_id TEXT,descriptor TEXT) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS session_interruptions_run ON session_interruptions(run_id);
      CREATE TABLE IF NOT EXISTS interruption_fields(message_id TEXT,part INTEGER,field TEXT,field_order INTEGER,kind TEXT,bytes INTEGER,PRIMARY KEY(message_id,part,field)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS interruption_chunks(message_id TEXT,part INTEGER,field TEXT,chunk INTEGER,body TEXT,PRIMARY KEY(message_id,part,field,chunk)) WITHOUT ROWID;
    `);
  };

  deleteMessage = (messageId: string): void => {
    for (const table of ["part_fields", "part_chunks", "part_previews"]) this.database.prepare(`DELETE FROM ${table} WHERE message_id=?`).run(messageId);
  };

  writePart = (messageId: string, part: number, value: NcpMessage["parts"][number]): number => {
    let bytes = 0;
    let order = 0;
    for (const [field, body] of Object.entries(value)) {
      if (body === undefined) continue;
      bytes += this.writeField(messageId, part, field, body, order++) + Buffer.byteLength(field) + 32;
    }
    return bytes;
  };

  writeField = (messageId: string, part: number, field: string, value: unknown, order?: number): number => {
    this.database.prepare("INSERT OR IGNORE INTO part_previews VALUES (?,?,'{}')").run(messageId, part);
    const existing = this.database.prepare("SELECT field_order FROM part_fields WHERE message_id=? AND part=? AND field=?").get(messageId, part, field) as { field_order: number } | undefined;
    const fieldOrder = FIELD_ORDER[field] ?? (order !== undefined ? 100 + order : existing?.field_order ?? Math.max(100, Number((this.database.prepare("SELECT COALESCE(MAX(field_order),-1)+1 AS value FROM part_fields WHERE message_id=? AND part=?").get(messageId, part) as { value: number }).value)));
    this.database.prepare("DELETE FROM part_chunks WHERE message_id=? AND part=? AND field=?").run(messageId, part, field);
    let bytes = 0;
    let chunk = 0;
    const kind = typeof value === "string" ? "string" : "json";
    for (const body of this.fieldChunks(value)) {
      bytes += Buffer.byteLength(body);
      this.database.prepare("INSERT INTO part_chunks(message_id,part,field,chunk,body) VALUES (?,?,?,?,?)").run(messageId, part, field, chunk++, body);
    }
    this.database.prepare("INSERT OR REPLACE INTO part_fields VALUES (?,?,?,?,?,?)").run(messageId, part, field, fieldOrder, kind, bytes);
    return bytes;
  };

  private *fieldChunks(value: unknown): Generator<string> {
    if (typeof value !== "string") { yield* sessionJsonChunks(value); return; }
    if (!value.length) { yield ""; return; }
    for (let start = 0; start < value.length; start += 1_024) yield JSON.stringify(value.slice(start, start + 1_024)).slice(1, -1);
  }

  readFragment = (messageId: string, part: number, position: PartFragmentPosition) => {
    const field = this.database.prepare("SELECT field,field_order,kind,bytes FROM part_fields WHERE message_id=? AND part=? AND field_order>=? ORDER BY field_order LIMIT 1").get(messageId, part, position.field) as FieldRow | undefined;
    if (!field) return null;
    const row = this.database.prepare("SELECT body FROM part_chunks WHERE message_id=? AND part=? AND field=? AND chunk=?").get(messageId, part, field.field, position.chunk) as { body: string } | undefined;
    if (!row) return null;
    const moreChunks = Boolean(this.database.prepare("SELECT 1 FROM part_chunks WHERE message_id=? AND part=? AND field=? AND chunk=?").get(messageId, part, field.field, position.chunk + 1));
    const nextField = !moreChunks ? this.database.prepare("SELECT field_order FROM part_fields WHERE message_id=? AND part=? AND field_order>? ORDER BY field_order LIMIT 1").get(messageId, part, field.field_order) as { field_order: number } | undefined : undefined;
    const first = position.chunk === 0;
    const prefix = first ? `${field.field_order === 0 ? "{" : ","}${JSON.stringify(field.field)}:${field.kind === "string" ? '"' : ""}` : "";
    const suffix = moreChunks ? "" : `${field.kind === "string" ? '"' : ""}${nextField ? "" : "}"}`;
    return { content: prefix + row.body + suffix, next: moreChunks ? { field: field.field_order, chunk: position.chunk + 1 } : nextField ? { field: nextField.field_order, chunk: 0 } : null };
  };

  assemble = (messageId: string, startPart = 0): NcpMessage["parts"] => {
    const fields = this.database.prepare("SELECT part,field,kind FROM part_fields WHERE message_id=? AND part>=? ORDER BY part,field_order").all(messageId, startPart) as (Pick<FieldRow, "field" | "kind"> & { part: number })[];
    const parts = new Map<number, Record<string, unknown>>();
    for (const field of fields) {
      const chunks = this.database.prepare("SELECT body FROM part_chunks WHERE message_id=? AND part=? AND field=? ORDER BY chunk").all(messageId, field.part, field.field) as { body: string }[];
      const json = chunks.map(chunk => chunk.body).join("");
      const part = parts.get(field.part) ?? Object.create(null);
      Object.defineProperty(part, field.field, { value: JSON.parse(field.kind === "string" ? `"${json}"` : json), enumerable: true, configurable: true, writable: true });
      parts.set(field.part, part);
    }
    return [...parts.values()] as NcpMessage["parts"];
  };

  measureView = (messageId: string, startPart: number, fieldLimit: number) => {
    const fields = this.database.prepare("SELECT part,bytes,length(field) AS key_bytes FROM part_fields WHERE message_id=? AND part>=? ORDER BY part,field LIMIT ?").all(messageId, startPart, fieldLimit + 1) as { part: number; bytes: number; key_bytes: number }[];
    return { indices: [...new Set(fields.map(field => field.part))], fields: fields.length,
      bytes: fields.reduce((sum, field) => sum + field.bytes + field.key_bytes * 3 + 32, 0),
      complete: fields.length <= fieldLimit };
  };

  captureToken = (token: SessionJsonToken, path: readonly string[]): void => {
    if (!this.capture && ["startObject", "startArray", "startString", "numberValue", "nullValue", "trueValue", "falseValue"].includes(token.name)) {
      // The parts array path has four components, followed by the part and field.
      const partField = path.length === 6 && path.slice(0, 4).join(".") === "event.payload.message.parts";
      const payloadField = path.length === 3 && path[0] === "event" && path[1] === "payload"
        && ["delta", "args", "content", "contentItems"].includes(path[2]!);
      if (partField || payloadField) {
        const part = partField ? Number(path[4]) : -1;
        const field = path.at(-1)!;
        this.capture = { path: [...path], source: partField ? "part" : "payload", part, field,
          kind: token.name === "startString" ? "string" : "json", chunk: 0, pending: "", bytes: 0, containers: [] };
      }
    }
    const capture = this.capture;
    if (!capture) return;
    if (capture.kind === "string") {
      if (token.name === "stringChunk") this.appendCapture(capture, JSON.stringify(token.value ?? "").slice(1, -1));
    } else this.appendCapture(capture, this.serializeToken(capture, token));
    const samePath = path.length === capture.path.length && path.every((value, index) => value === capture.path[index]);
    if (samePath && ["endObject", "endArray", "endString", "numberValue", "nullValue", "trueValue", "falseValue"].includes(token.name)) {
      if (this.omitSmallDeltaStaging && capture.source === "payload" && capture.field === "delta" && capture.kind === "string"
        && capture.chunk === 0 && capture.pending.length <= 2_048) { this.capture = undefined; return; }
      this.flushCapture(capture, true);
      const order = Number((this.database.prepare("SELECT COUNT(*) AS value FROM staged_fields WHERE source=? AND part=?").get(capture.source, capture.part) as { value: number }).value);
      this.database.prepare("INSERT OR REPLACE INTO staged_fields VALUES (?,?,?,?,?,?)").run(capture.source, capture.part, capture.field, order, capture.kind, capture.bytes);
      this.capture = undefined;
    }
  };

  private serializeToken = (capture: Capture, token: SessionJsonToken): string => {
    const parent = capture.containers.at(-1);
    const beforeValue = () => parent?.kind === "array" ? (parent.count++ ? "," : "") : "";
    switch (token.name) {
      case "startObject": { const prefix = beforeValue(); capture.containers.push({ kind: "object", count: 0 }); return prefix + "{"; }
      case "startArray": { const prefix = beforeValue(); capture.containers.push({ kind: "array", count: 0 }); return prefix + "["; }
      case "endObject": capture.containers.pop(); return "}";
      case "endArray": capture.containers.pop(); return "]";
      case "startKey": return `${parent && parent.count++ ? "," : ""}"`;
      case "endKey": return '":';
      case "startString": return beforeValue() + '"';
      case "endString": return '"';
      // JSON.stringify preserves even an unpaired UTF-16 surrogate across parser chunk boundaries.
      case "stringChunk": return JSON.stringify(token.value ?? "").slice(1, -1);
      case "numberValue": return beforeValue() + token.value;
      case "trueValue": return beforeValue() + "true";
      case "falseValue": return beforeValue() + "false";
      case "nullValue": return beforeValue() + "null";
      default: return "";
    }
  };

  private appendCapture = (capture: Capture, fragment: string): void => {
    if (Buffer.byteLength(capture.pending) + Buffer.byteLength(fragment) > 8 * 1024 && capture.pending) this.flushCapture(capture, false);
    capture.pending += fragment;
  };
  private flushCapture = (capture: Capture, final: boolean): void => {
    if (!capture.pending && (!final || capture.chunk > 0)) return;
    this.database.prepare("INSERT INTO staged_chunks VALUES (?,?,?,?,?)").run(capture.source, capture.part, capture.field, capture.chunk++, capture.pending);
    this.hasStagedRows = true;
    capture.bytes += Buffer.byteLength(capture.pending);
    capture.pending = "";
  };

  clearStaging = (source?: string): void => {
    this.capture = undefined;
    if (!this.hasStagedRows) return;
    if (source) {
      this.database.prepare("DELETE FROM staged_fields WHERE source=?").run(source);
      this.database.prepare("DELETE FROM staged_chunks WHERE source=?").run(source);
      return;
    }
    this.database.exec("DELETE FROM staged_fields; DELETE FROM staged_chunks;");
    this.hasStagedRows = false;
  };

  clearStagingBounded = async (signal?: AbortSignal): Promise<void> => {
    if (!this.hasStagedRows) return;
    this.capture = undefined;
    for (const [table, key] of [["staged_chunks", "source,part,field,chunk"], ["staged_fields", "source,part,field"]]) {
      while (this.database.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get()) {
        signal?.throwIfAborted();
        this.database.exec(`DELETE FROM ${table} WHERE (${key}) IN (SELECT ${key} FROM ${table} ORDER BY ${key} LIMIT 64)`);
        if (this.database.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get()) await (this.database.transactionYield?.() ?? new Promise<void>(resolve => setTimeout(resolve, 0)));
      }
    }
    this.hasStagedRows = false;
  };

  promoteSnapshot = async (messageId: string): Promise<void> => {
    this.database.prepare("INSERT OR REPLACE INTO part_fields SELECT ?,part,field,field_order,kind,bytes FROM staged_fields WHERE source='part'").run(messageId);
    await this.copyChunksInBatches({ table: "part_chunks", alias: "s", from: "FROM staged_chunks s WHERE s.source='part'", params: [],
      select: "?,s.part,s.field,s.chunk,s.body", insertParams: [messageId] });
    this.database.prepare("INSERT OR IGNORE INTO part_previews SELECT ?,part,'{}' FROM staged_fields WHERE source='part' GROUP BY part").run(messageId);
    for (const [field, order] of Object.entries(FIELD_ORDER)) this.database.prepare("UPDATE part_fields SET field_order=? WHERE message_id=? AND field=?").run(order, messageId, field);
    this.database.prepare("UPDATE part_fields SET field_order=field_order+100 WHERE message_id=? AND field NOT IN ('type','text','toolCallId','toolName','state','args','result','resultContentItems','execution')").run(messageId);
  };

  retainSettledResults = async (messageId: string): Promise<void> => {
    this.hasStagedRows = true;
    this.database.exec("DELETE FROM staged_fields WHERE source='settled'; DELETE FROM staged_chunks WHERE source='settled';");
    this.database.prepare(`INSERT OR REPLACE INTO staged_fields SELECT 'settled',f.part,f.field,f.field_order,f.kind,f.bytes FROM part_fields f
      JOIN settled_tools t ON t.message_id=f.message_id AND t.part=f.part
      WHERE f.message_id=? AND f.field IN ('result','resultContentItems','execution')`).run(messageId);
    await this.copyChunksInBatches({ table: "staged_chunks", alias: "c", from: `FROM part_chunks c
      JOIN settled_tools t ON t.message_id=c.message_id AND t.part=c.part
      WHERE c.message_id=? AND c.field IN ('result','resultContentItems','execution')`, params: [messageId],
      select: "'settled',c.part,c.field,c.chunk,c.body", insertParams: [] });
  };

  restoreSettledResults = async (messageId: string): Promise<void> => {
    this.database.prepare(`DELETE FROM part_chunks WHERE message_id=? AND field IN ('result','resultContentItems','execution') AND part IN
      (SELECT o.part FROM tool_owners o JOIN settled_tools t ON t.call_id=o.call_id WHERE o.message_id=?)`).run(messageId, messageId);
    this.database.prepare(`DELETE FROM part_fields WHERE message_id=? AND field IN ('result','resultContentItems','execution') AND part IN
      (SELECT o.part FROM tool_owners o JOIN settled_tools t ON t.call_id=o.call_id WHERE o.message_id=?)`).run(messageId, messageId);
    this.database.prepare(`INSERT OR REPLACE INTO part_fields SELECT ?,o.part,s.field,s.field_order,s.kind,s.bytes FROM staged_fields s
      JOIN settled_tools t ON t.part=s.part AND t.message_id=? JOIN tool_owners o ON o.call_id=t.call_id AND o.message_id=? WHERE s.source='settled'`).run(messageId, messageId, messageId);
    await this.copyChunksInBatches({ table: "part_chunks", alias: "s", from: `FROM staged_chunks s
      JOIN settled_tools t ON t.part=s.part AND t.message_id=? JOIN tool_owners o ON o.call_id=t.call_id AND o.message_id=? WHERE s.source='settled'`, params: [messageId, messageId],
      select: "?,o.part,s.field,s.chunk,s.body", insertParams: [messageId] });
    this.database.prepare("UPDATE settled_tools SET part=(SELECT part FROM tool_owners WHERE tool_owners.call_id=settled_tools.call_id) WHERE message_id=? AND EXISTS (SELECT 1 FROM tool_owners WHERE tool_owners.call_id=settled_tools.call_id)").run(messageId);
    this.database.prepare("INSERT OR REPLACE INTO part_fields SELECT ?,o.part,'state',4,'string',6 FROM tool_owners o JOIN settled_tools t ON t.call_id=o.call_id WHERE o.message_id=?").run(messageId, messageId);
    this.database.prepare("DELETE FROM part_chunks WHERE message_id=? AND field='state' AND part IN (SELECT o.part FROM tool_owners o JOIN settled_tools t ON t.call_id=o.call_id WHERE o.message_id=?)").run(messageId, messageId);
    this.database.prepare("INSERT INTO part_chunks SELECT ?,o.part,'state',0,'result' FROM tool_owners o JOIN settled_tools t ON t.call_id=o.call_id WHERE o.message_id=?").run(messageId, messageId);
  };

  private copyChunksInBatches = async (query: { table: string; alias: string; from: string; params: unknown[]; select: string; insertParams: unknown[] }): Promise<void> => {
    const { table, alias, from, params, select, insertParams } = query;
    const key = `(${alias}.part,${alias}.field,${alias}.chunk)`;
    let after: [number, string, number] = [-2, "", -1];
    for (;;) {
      const rows = this.database.prepare(`SELECT ${alias}.part AS part,${alias}.field AS field,${alias}.chunk AS chunk ${from} AND ${key}>(?,?,?)
        ORDER BY ${alias}.part,${alias}.field,${alias}.chunk LIMIT 64`).all(...params, ...after) as { part: number; field: string; chunk: number }[];
      if (!rows.length) return;
      const last = rows.at(-1)!;
      const end: [number, string, number] = [last.part, last.field, last.chunk];
      this.database.prepare(`INSERT OR REPLACE INTO ${table} SELECT ${select} ${from} AND ${key}>(?,?,?) AND ${key}<=(?,?,?)`)
        .run(...insertParams, ...params, ...after, ...end);
      after = end;
      if (rows.length < 64) return;
      await (this.database.transactionYield?.() ?? new Promise<void>(resolve => setTimeout(resolve, 0)));
    }
  };

  stagePayload = (field: string, value: unknown, source = "payload"): void => {
    this.hasStagedRows = true;
    const kind = typeof value === "string" ? "string" : "json";
    let chunk = 0;
    let bytes = 0;
    for (const body of this.fieldChunks(value)) {
      bytes += Buffer.byteLength(body);
      this.database.prepare("INSERT INTO staged_chunks VALUES (?,-1,?,?,?)").run(source, field, chunk++, body);
    }
    this.database.prepare("INSERT INTO staged_fields VALUES (?,-1,?,0,?,?)").run(source, field, kind, bytes);
  };

  promotePayload = (messageId: string, part: number, sourceField: string, targetField: string, append = false, sourceName = "payload"): void => {
    const source = this.database.prepare("SELECT kind,bytes FROM staged_fields WHERE source=? AND part=-1 AND field=?").get(sourceName, sourceField) as Pick<FieldRow, "kind" | "bytes"> | undefined;
    if (!source) return;
    if (append && source.bytes === 0) return;
    const existing = this.database.prepare("SELECT field_order,kind,bytes FROM part_fields WHERE message_id=? AND part=? AND field=?").get(messageId, part, targetField) as Omit<FieldRow, "field"> | undefined;
    if (append && existing && (source.kind !== "string" || existing.kind !== "string")) throw new Error("Cannot append a text delta to a structured part field.");
    const order = existing?.field_order ?? Number((this.database.prepare("SELECT COALESCE(MAX(field_order),-1)+1 AS value FROM part_fields WHERE message_id=? AND part=?").get(messageId, part) as { value: number }).value);
    if (!append) this.database.prepare("DELETE FROM part_chunks WHERE message_id=? AND part=? AND field=?").run(messageId, part, targetField);
    const last = append ? this.database.prepare("SELECT chunk,body FROM part_chunks WHERE message_id=? AND part=? AND field=? ORDER BY chunk DESC LIMIT 1").get(messageId, part, targetField) as { chunk: number; body: string } | undefined : undefined;
    let chunk = last ? last.chunk + 1 : 0;
    let skipped = 0;
    const first = this.database.prepare("SELECT body FROM staged_chunks WHERE source=? AND part=-1 AND field=? AND chunk=0").get(sourceName, sourceField) as { body: string } | undefined;
    if (last && first && Buffer.byteLength(last.body) + Buffer.byteLength(first.body) <= 8 * 1024) {
      this.database.prepare("UPDATE part_chunks SET body=body||? WHERE message_id=? AND part=? AND field=? AND chunk=?").run(first.body, messageId, part, targetField, last.chunk);
      skipped = 1; chunk -= 1;
    }
    this.database.prepare("INSERT INTO part_chunks SELECT ?,?,?,chunk+?,body FROM staged_chunks WHERE source=? AND part=-1 AND field=? AND chunk>=?").run(messageId, part, targetField, chunk, sourceName, sourceField, skipped);
    this.database.prepare("INSERT OR REPLACE INTO part_fields VALUES (?,?,?,?,?,?)").run(messageId, part, targetField, order, source.kind, source.bytes + (append ? existing?.bytes ?? 0 : 0));
  };

  readPreview = (messageId: string, part: number): NcpMessage["parts"][number] => {
    const fields = this.database.prepare("SELECT field,field_order,kind,bytes FROM part_fields WHERE message_id=? AND part=? ORDER BY field_order LIMIT 24").all(messageId, part) as FieldRow[];
    const value: Record<string, unknown> = Object.create(null);
    let budget = 8 * 1024;
    for (const field of fields) {
      if (budget <= 0) { value[field.field] = "[archived; read source]"; continue; }
      const chunks = this.database.prepare("SELECT body FROM part_chunks WHERE message_id=? AND part=? AND field=? ORDER BY chunk LIMIT ?").all(messageId, part, field.field, field.bytes <= budget ? 16 : 1) as { body: string }[];
      const json = chunks.map(chunk => chunk.body).join("");
      budget -= Math.min(field.bytes, Buffer.byteLength(json));
      if (field.kind === "string") {
        value[field.field] = JSON.parse(`"${json}"`);
        if (field.bytes > Buffer.byteLength(json)) value[field.field] += "\n[archived; read source]";
      } else if (field.bytes <= Buffer.byteLength(json)) value[field.field] = JSON.parse(json);
      else value[field.field] = "[archived structured value; read source]";
    }
    return value as NcpMessage["parts"][number];
  };

  recentParts = (messageId: string, limit = 16): { indices: number[]; parts: NcpMessage["parts"] } => {
    const rows = this.database.prepare("SELECT part FROM part_previews WHERE message_id=? ORDER BY part DESC LIMIT ?").all(messageId, limit) as { part: number }[];
    const indices = rows.map(row => row.part).reverse();
    return { indices, parts: indices.map(part => this.readPreview(messageId, part)) };
  };

  readBoundedField = (messageId: string, part: number, field: string, maxBytes: number): unknown => {
    const meta = this.database.prepare("SELECT kind,bytes FROM part_fields WHERE message_id=? AND part=? AND field=?").get(messageId, part, field) as Pick<FieldRow, "kind" | "bytes"> | undefined;
    if (!meta || meta.bytes > maxBytes) return undefined;
    const chunks = this.database.prepare("SELECT body FROM part_chunks WHERE message_id=? AND part=? AND field=? ORDER BY chunk").all(messageId, part, field) as { body: string }[];
    const text = chunks.map(chunk => chunk.body).join("");
    return JSON.parse(meta.kind === "string" ? `"${text}"` : text);
  };
}
