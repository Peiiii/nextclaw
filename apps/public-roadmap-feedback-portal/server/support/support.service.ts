import type { DiscussionActor, SupportOperation, SupportSubmission } from "@nextclaw/shared";
import type { SupportRepository, StoredSupport } from "./support.repository.js";
import { digest, identifier, receiptKey, reject, secureEqual, textField } from "./support-validation.utils.js";

export class SupportService {
  constructor(readonly repository: SupportRepository) {}
  submit = async (raw: SupportSubmission, userId: string | null, source: string): Promise<StoredSupport["report"]> => {
    const id = identifier(raw.requestId), key = receiptKey(raw.receiptKey);
    const content = {
      title: textField(raw.title, "标题", 100), description: textField(raw.description, "问题描述", 8000),
      environment: textField(raw.environment, "环境", 2000, true), version: textField(raw.version, "版本", 100, true)
    };
    const receiptHash = await digest(key), payloadHash = await digest(JSON.stringify(content));
    const existing = await this.repository.get(id);
    if (existing) return this.checkSubmission(existing, receiptHash, payloadHash);
    await this.repository.limit("submit:" + await digest(source), userId ? 30 : 10);
    if (userId) await this.repository.limit("account:" + await digest(userId), 30);
    const now = new Date().toISOString();
    const openedBy = reporterActor(userId);
    const value: StoredSupport = {
      receiptHash, payloadHash, userId, operations: {},
      report: { id, ...content, status: "received", kind: "unknown", priority: 2, authority: "analyze",
        identity: userId ? "verified" : "anonymous", createdAt: now, updatedAt: now, revision: 1,
        openedBy, inputVersion: 1, runId: null, attempts: 0, approval: null, messages: [], release: null, evidence: "", relatedUrl: null }
    };
    return this.checkSubmission(await this.repository.create(value), receiptHash, payloadHash);
  };
  private checkSubmission = (value: StoredSupport, receiptHash: string, payloadHash: string) => {
    if (!secureEqual(value.receiptHash, receiptHash) || value.payloadHash !== payloadHash) reject(409, "提交标识已使用，请恢复原草稿或开始新的反馈。");
    return value.report;
  };
  access = async (id: string, key: string, userId: string | null): Promise<StoredSupport> => {
    const value = await this.repository.get(identifier(id));
    if (!value) reject(404, "反馈不存在或回执无效。");
    const hasKey = /^[a-f0-9]{64}$/.test(key) && secureEqual(value.receiptHash, await digest(key));
    if (!hasKey && (!userId || userId !== value.userId)) reject(404, "反馈不存在或回执无效。");
    return value;
  };
  operate = async (value: StoredSupport, raw: SupportOperation, userId: string | null) => {
    const op = identifier(raw.operationId), fingerprint = await digest(JSON.stringify(raw));
    if (value.operations[op]) {
      if (value.operations[op] !== fingerprint) reject(409, "操作标识已使用。");
      return value.report;
    }
    await this.repository.limit("reply:" + value.report.id, 30);
    const expected = value.report.revision, report = value.report;
    let messageBody: string | undefined;
    if (Object.keys(value.operations).length >= 500) reject(409, "该反馈操作次数已达上限，请联系维护者。");
    if (raw.action === "link") {
      if (!userId) reject(401, "账号暂未验证，反馈仍可凭回执查看。");
      if (value.userId && value.userId !== userId) reject(403, "反馈已关联其它账号。");
      value.userId = userId; report.identity = "verified";
    } else if (raw.action === "withdraw") {
      report.status = "withdrawn"; report.runId = null; report.approval = null; report.authority = "analyze";
    } else if (raw.action === "reply" || raw.action === "reopen") {
      messageBody = textField(raw.body, "补充信息", 4000);
      if (report.messages.length >= 200) reject(409, "该反馈回复已达上限，请联系维护者。");
      report.inputVersion++;
      // New evidence invalidates the active generation before any further action.
      this.invalidateApproval(report);
    } else reject(400, "不支持的操作。");
    report.revision++; report.updatedAt = new Date().toISOString();
    value.operations[op] = fingerprint;
    await this.repository.save(value, expected, {
      operationId: op, operationHash: fingerprint,
      actor: messageBody ? reporterActor(userId) : undefined,
      body: messageBody,
      audienceRole: messageBody ? "administrator" : undefined,
    });
    return (await this.repository.get(report.id))!.report;
  };
  private invalidateApproval = (report: StoredSupport["report"]): void => {
    report.status = "received"; report.runId = null; report.attempts = 0; report.authority = "analyze";
    delete report.fixedCommit;
    report.approval = null;
  };
}

function reporterActor(userId: string | null): DiscussionActor {
  return userId
    ? { id: userId, kind: "human", displayName: "已验证用户", roles: ["reporter"], authenticated: true }
    : { id: null, kind: "anonymous", displayName: "匿名用户", roles: ["reporter"], authenticated: false };
}
