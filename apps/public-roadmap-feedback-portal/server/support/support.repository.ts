import type { SupportReport } from "../../shared/support-feedback.types.js";
import type { D1Database } from "../portal-env.types.js";
import { reject } from "./support-validation.utils.js";

export type StoredSupport = { report: SupportReport; userId: string | null; receiptHash: string; payloadHash: string; operations: Record<string, string> };
type Row = { document: string; receipt_hash: string; user_id: string | null; payload_hash: string };

export class SupportRepository {
  constructor(private readonly db: D1Database) {}
  private decode = (row: Row): StoredSupport => {
    const document = JSON.parse(row.document) as { report: SupportReport; operations: Record<string, string> };
    return { ...document, userId: row.user_id, receiptHash: row.receipt_hash, payloadHash: row.payload_hash };
  };
  get = async (id: string): Promise<StoredSupport | null> => {
    const row = await this.db.prepare("SELECT * FROM support_reports WHERE id = ?").bind(id).first<Row>();
    return row ? this.decode(row) : null;
  };
  create = async (value: StoredSupport): Promise<StoredSupport> => {
    const r = value.report;
    await this.db.prepare(`INSERT INTO support_reports
      (id, receipt_hash, user_id, payload_hash, document, revision, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
      .bind(r.id, value.receiptHash, value.userId, value.payloadHash, JSON.stringify({ report: r, operations: value.operations }),
        r.revision, r.status, r.priority, r.createdAt, r.updatedAt).run();
    return (await this.get(r.id))!;
  };
  save = async (value: StoredSupport, expected: number): Promise<void> => {
    const r = value.report;
    const row = await this.db.prepare(`UPDATE support_reports SET document=?, user_id=?, revision=?, status=?, priority=?, updated_at=?
      WHERE id=? AND revision=? RETURNING id`)
      .bind(JSON.stringify({ report: r, operations: value.operations }), value.userId, r.revision, r.status, r.priority, r.updatedAt, r.id, expected).first();
    if (!row) reject(409, "反馈已变化，请刷新后继续。");
  };
  list = async (userId: string | null, cursor: string, status: string, maintenance: boolean): Promise<{ items: SupportReport[]; nextCursor: string | null }> => {
    // Stable ID pagination visits every row; queue ranking happens over the complete scan.
    const query = maintenance
      ? "SELECT * FROM support_reports WHERE id > ? AND (? = '' OR status = ?) ORDER BY id LIMIT 21"
      : "SELECT * FROM support_reports WHERE user_id = ? AND id > ? ORDER BY id LIMIT 21";
    const args = maintenance ? [cursor, status, status] : [userId, cursor];
    const { results } = await this.db.prepare(query).bind(...args).all<Row>();
    const reports = results.map((row) => this.decode(row).report);
    return { items: reports.slice(0, 20), nextCursor: reports.length > 20 ? reports[19]!.id : null };
  };
  reviewList = async (bucket: string, search: string, page: number, pageSize: number) => {
    const approved = "COALESCE(json_extract(document, '$.report.approval.inputVersion') = json_extract(document, '$.report.inputVersion'), 0)";
    const filters: Record<string, string> = {
      review: "(status = 'needs-decision' OR (status = 'received' AND NOT " + approved + "))",
      working: "(status = 'working' OR (status = 'received' AND " + approved + "))",
      ready: "status = 'ready'", waiting: "status = 'needs-info'",
      closed: "status IN ('published','resolved','withdrawn')", all: "1=1"
    };
    if (!Object.hasOwn(filters, bucket)) reject(400, "反馈筛选条件不正确。");
    const where = filters[bucket] + " AND (json_extract(document, '$.report.title') LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\')";
    const term = "%" + search.replace(/[\\%_]/g, "\\$&") + "%";
    const count = await this.db.prepare("SELECT COUNT(*) AS total FROM support_reports WHERE " + where).bind(term, term).first<{ total: number }>();
    const total = count?.total ?? 0;
    const current = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const { results } = await this.db.prepare("SELECT * FROM support_reports WHERE " + where + " ORDER BY priority, created_at, id LIMIT ? OFFSET ?")
      .bind(term, term, pageSize, (current - 1) * pageSize).all<Row>();
    return { items: results.map(row => this.decode(row).report), total, page: current, pageSize };
  };
  limit = async (key: string, max: number): Promise<void> => {
    const now = Math.floor(Date.now() / 1000), expires = now + 3600;
    const row = await this.db.prepare(`INSERT INTO support_rate_limits(key,count,expires_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
      expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END
      WHERE expires_at<=? OR count<? RETURNING count`)
      .bind(key, expires, now, now, expires, now, max).first();
    if (!row) reject(429, "提交过于频繁，请一小时后重试。草稿仍可保留。");
    await this.db.prepare("DELETE FROM support_rate_limits WHERE expires_at < ?").bind(now).run();
  };
}
