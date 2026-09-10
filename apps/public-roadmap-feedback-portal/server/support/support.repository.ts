import type { DiscussionActor, DiscussionPost, DiscussionThread, SupportMessage, SupportReport } from "@nextclaw/shared";
import type { D1Database, D1PreparedStatement } from "../portal-env.types.js";
import { DiscussionRepository, type DiscussionWriteCondition } from "../discussion/discussion.repository.js";
import { DiscussionTransactionService } from "../discussion/discussion-transaction.service.js";
import { reject } from "./support-validation.utils.js";

export type StoredSupport = {
  report: SupportReport;
  userId: string | null;
  receiptHash: string;
  payloadHash: string;
  operations: Record<string, string>;
};

export type SupportDiscussionMutation = {
  operationId: string;
  operationHash: string;
  actor?: DiscussionActor;
  body?: string;
  audienceRole?: string;
};

type StoredWorkflowReport = Omit<SupportReport, "title" | "description" | "openedBy" | "messages">;
type Row = { id: string; document: string; receipt_hash: string; user_id: string | null; payload_hash: string };

export class SupportRepository {
  private readonly discussions: DiscussionRepository;
  private readonly transaction: DiscussionTransactionService;

  constructor(private readonly db: D1Database) {
    this.discussions = new DiscussionRepository(db);
    this.transaction = new DiscussionTransactionService(db);
  }

  get = async (id: string): Promise<StoredSupport | null> => {
    const row = await this.db.prepare("SELECT * FROM support_reports WHERE id = ?").bind(id).first<Row>();
    return row ? this.decode(row) : null;
  };

  create = async (value: StoredSupport): Promise<StoredSupport> => {
    const report = value.report;
    const openedBy = report.openedBy;
    const thread: DiscussionThread = {
      id: report.id, space: "support", title: report.title, openedBy,
      createdAt: report.createdAt, updatedAt: report.updatedAt, lastEventCursor: 0,
    };
    const opening: DiscussionPost = {
      id: report.id + ":opening", threadId: report.id, sequence: 1, author: openedBy,
      body: report.description, createdAt: report.createdAt,
    };
    try {
      await this.transaction.commit(
        [this.prepareCreate(value)],
        this.discussions.prepareCreate(thread, opening, value.payloadHash, "administrator"),
      );
    } catch {
      const existing = await this.get(report.id);
      if (existing) return existing;
      throw new Error("Unable to create support discussion.");
    }
    return (await this.get(report.id))!;
  };

  save = async (value: StoredSupport, expected: number, mutation: SupportDiscussionMutation): Promise<void> => {
    const report = value.report;
    const condition: DiscussionWriteCondition = {
      sql: "EXISTS (SELECT 1 FROM support_reports WHERE id=? AND json_extract(document, ?)=?)",
      values: [report.id, `$."operations"."${mutation.operationId}"`, mutation.operationHash],
    };
    const discussion = mutation.body && mutation.actor && mutation.audienceRole
      ? this.discussions.preparePost({
        id: mutation.operationId, threadId: report.id, author: mutation.actor,
        body: mutation.body, createdAt: report.updatedAt,
      }, mutation.operationHash, mutation.audienceRole, "post-created", condition)
      : mutation.audienceRole ? this.discussions.prepareTouch(report.id, report.updatedAt, mutation.audienceRole, condition) : [];
    const results = await this.transaction.commit([this.prepareSave(value, expected)], discussion);
    if (Number(results[0]?.meta?.changes ?? 0) !== 1) reject(409, "反馈已变化，请刷新后继续。");
  };

  list = async (userId: string | null, cursor: string, status: string, privileged: boolean): Promise<{ items: SupportReport[]; nextCursor: string | null }> => {
    const query = privileged
      ? "SELECT * FROM support_reports WHERE id > ? AND (? = '' OR status = ?) ORDER BY id LIMIT 21"
      : "SELECT * FROM support_reports WHERE user_id = ? AND id > ? ORDER BY id LIMIT 21";
    const args = privileged ? [cursor, status, status] : [userId, cursor];
    const { results } = await this.db.prepare(query).bind(...args).all<Row>();
    const reports = await Promise.all(results.map(async row => (await this.decode(row)).report));
    return { items: reports.slice(0, 20), nextCursor: reports.length > 20 ? reports[19]!.id : null };
  };

  reviewList = async (bucket: string, search: string, page: number, pageSize: number) => {
    const approved = "COALESCE(json_extract(sr.document, '$.report.approval.inputVersion') = json_extract(sr.document, '$.report.inputVersion'), 0)";
    const filters: Record<string, string> = {
      review: "(sr.status = 'needs-decision' OR (sr.status = 'received' AND NOT " + approved + "))",
      working: "(sr.status = 'working' OR (sr.status = 'received' AND " + approved + "))",
      ready: "sr.status = 'ready'", waiting: "sr.status = 'needs-info'",
      closed: "sr.status IN ('published','resolved','withdrawn')", all: "1=1",
    };
    if (!Object.hasOwn(filters, bucket)) reject(400, "反馈筛选条件不正确。");
    const where = filters[bucket] + " AND (dt.title LIKE ? ESCAPE '\\' OR sr.id LIKE ? ESCAPE '\\')";
    const term = "%" + search.replace(/[\\%_]/g, "\\$&") + "%";
    const count = await this.db.prepare(`SELECT COUNT(*) AS total FROM support_reports sr JOIN discussion_threads dt ON dt.id=sr.id WHERE ${where}`)
      .bind(term, term).first<{ total: number }>();
    const total = count?.total ?? 0;
    const current = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const { results } = await this.db.prepare(`SELECT sr.* FROM support_reports sr JOIN discussion_threads dt ON dt.id=sr.id
      WHERE ${where} ORDER BY sr.priority, sr.created_at, sr.id LIMIT ? OFFSET ?`)
      .bind(term, term, pageSize, (current - 1) * pageSize).all<Row>();
    return { items: await Promise.all(results.map(async row => (await this.decode(row)).report)), total, page: current, pageSize };
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

  private decode = async (row: Row): Promise<StoredSupport> => {
    const document = JSON.parse(row.document) as { report: StoredWorkflowReport; operations: Record<string, string> };
    const discussion = await this.discussions.get(row.id);
    if (!discussion || !discussion.posts[0]) reject(503, "反馈讨论数据暂不可用。");
    const messages: SupportMessage[] = discussion.posts.slice(1).map(post => ({
      id: post.id, actor: post.author,
      body: post.body, createdAt: post.createdAt,
    }));
    const report: SupportReport = {
      ...document.report, title: discussion.thread.title, description: discussion.posts[0].body,
      openedBy: discussion.thread.openedBy, messages,
    };
    return { report, operations: document.operations, userId: row.user_id, receiptHash: row.receipt_hash, payloadHash: row.payload_hash };
  };

  private prepareCreate = (value: StoredSupport): D1PreparedStatement => {
    const report = value.report;
    return this.db.prepare(`INSERT INTO support_reports
      (id, receipt_hash, user_id, payload_hash, document, revision, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(report.id, value.receiptHash, value.userId, value.payloadHash, this.document(value),
        report.revision, report.status, report.priority, report.createdAt, report.updatedAt);
  };

  private prepareSave = (value: StoredSupport, expected: number): D1PreparedStatement => {
    const report = value.report;
    return this.db.prepare(`UPDATE support_reports SET document=?, user_id=?, revision=?, status=?, priority=?, updated_at=?
      WHERE id=? AND revision=?`)
      .bind(this.document(value), value.userId, report.revision, report.status, report.priority, report.updatedAt, report.id, expected);
  };

  private document = (value: StoredSupport): string => {
    const { title: _title, description: _description, openedBy: _openedBy, messages: _messages, ...report } = value.report;
    return JSON.stringify({ report, operations: value.operations });
  };
}
