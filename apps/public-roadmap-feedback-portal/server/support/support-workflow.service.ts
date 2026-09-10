import { SUPPORT_KINDS, type DiscussionActor, type SupportWorkflowOperation, type SupportReport } from "@nextclaw/shared";
import type { PortalWorkerEnv } from "../portal-env.types.js";
import type { SupportRepository } from "./support.repository.js";
import { SupportReleaseService } from "./support-release.service.js";
import { digest, identifier, reject, safeUrl, textField } from "./support-validation.utils.js";

const authorityRank = { analyze: 0, repair: 1, deliver: 2 };
export class SupportWorkflowService {
  constructor(private readonly repository: SupportRepository, private readonly env: PortalWorkerEnv) {}
  operate = async (id: string, input: SupportWorkflowOperation, actor: DiscussionActor) => {
    if (this.env.SUPPORT_PAUSED === "true") reject(409, "维护处理已暂停。");
    const value = await this.repository.get(identifier(id));
    if (!value) reject(404, "反馈不存在。");
    const op = identifier(input.operationId), hash = await digest(JSON.stringify({ input, actor }));
    if (value.operations[op]) {
      if (value.operations[op] !== hash) reject(409, "操作标识已使用。");
      return value.report;
    }
    const report = value.report;
    if (Object.keys(value.operations).length >= 500) reject(409, "操作记录已达上限。");
    if (input.revision !== report.revision || input.runId !== report.runId) reject(409, "执行代次已失效，请重新读取反馈。");
    if (report.status === "withdrawn") reject(409, "用户已撤回反馈。");
    const before = report.revision;
    if (input.action === "review") {
      if (!actor.roles.includes("administrator")) reject(403, "执行 AI 无权审批反馈。");
      this.review(report, input);
    } else await this.transition(report, input);
    let body: string | undefined;
    if (input.body) {
      if (report.messages.length >= 200) reject(409, "回复数量已达上限。");
      body = textField(input.body, "回复", 4000);
    }
    report.updatedAt = new Date().toISOString(); report.revision++;
    value.operations[op] = hash;
    await this.repository.save(value, before, {
      operationId: op, operationHash: hash, actor: body ? actor : undefined, body,
      audienceRole: actor.roles.includes("administrator") && report.approval?.inputVersion === report.inputVersion
        ? "participant" : body ? "administrator" : undefined,
    });
    return (await this.repository.get(report.id))!.report;
  };
  private transition = async (report: SupportReport, input: SupportWorkflowOperation): Promise<void> => {
    if (input.action === "triage") {
      this.classify(report, input);
    } else if (input.action === "claim") {
      this.claim(report);
    } else if (input.action === "recover") {
      if (!report.runId || !textField(input.evidence, "旧执行终止证据", 4000)) reject(409, "没有需要恢复的执行。");
      report.runId = null; report.status = "needs-decision"; report.evidence = input.evidence!;
      report.approval = null; report.authority = "analyze";
    } else if (input.action === "checkpoint") {
      if (!report.runId || report.status !== "working" || !["ready", "needs-info", "needs-decision"].includes(input.status ?? "")) reject(409, "执行状态不正确。");
      report.evidence = textField(input.evidence, "验证或阻塞证据", 4000);
      report.relatedUrl = safeUrl(input.relatedUrl);
      report.status = input.status!;
      if (report.status !== "ready") { report.runId = null; report.approval = null; report.authority = "analyze"; }
    } else if (input.action === "authorize-delivery") {
      if (report.approval?.authority !== "deliver" || report.approval.inputVersion !== report.inputVersion) reject(403, "管理员尚未批准发布此修复。");
      if (report.status !== "ready" || !report.runId || this.env.SUPPORT_MAX_AUTHORITY !== "deliver" || !/^[a-f0-9]{40}$/.test(input.fixedCommit ?? "")) reject(403, "交付授权或修复提交不完整。");
      report.authority = "deliver"; report.fixedCommit = input.fixedCommit;
    } else if (input.action === "publish") {
      if (report.approval?.authority !== "deliver" || report.approval.inputVersion !== report.inputVersion) reject(403, "发布批准已失效。");
      if (report.status !== "ready" || report.authority !== "deliver" || this.env.SUPPORT_MAX_AUTHORITY !== "deliver") reject(403, "反馈尚未获准交付。");
      report.release = await new SupportReleaseService(this.env).verify(input.release, report.fixedCommit);
      report.status = "published"; report.runId = null;
    } else if (input.action !== "reply") reject(400, "不支持的维护操作。");
  };
  private claim = (report: SupportReport): void => {
    if (!report.approval || report.approval.inputVersion !== report.inputVersion) reject(403, "此版本反馈尚未获管理员批准。");
    const ceiling = this.env.SUPPORT_MAX_AUTHORITY ?? "analyze";
    if (!Object.hasOwn(authorityRank, ceiling) || authorityRank[ceiling] < authorityRank[report.authority]) reject(403, "修复授权已收回。");
    if (report.runId || report.status !== "received" || report.authority === "analyze" || report.attempts >= 2) reject(409, "当前反馈不可领取修复。");
    report.runId = crypto.randomUUID(); report.status = "working"; report.attempts++; delete report.fixedCommit;
  };
  private classify = (report: SupportReport, input: SupportWorkflowOperation): void => {
    if (report.approval) reject(409, "已审批的反馈需由管理员撤销批准后重新分类。");
    if (report.runId) reject(409, "请先结束当前执行。");
    if (!SUPPORT_KINDS.includes(input.kind!) || !Number.isInteger(input.priority) || input.priority! < 0 || input.priority! > 3) reject(400, "分类或优先级不正确。");
    if (input.authority !== "analyze") reject(403, "分类不能授予修复或发布权限，请等待管理员评审。");
    const status = input.status ?? "needs-decision";
    if (!["needs-info", "needs-decision", "received", "resolved"].includes(status)) reject(400, "分类状态不正确。");
    report.kind = input.kind!; report.priority = input.priority!; report.authority = input.authority!; report.status = status;
  };
  private review = (report: SupportReport, input: SupportWorkflowOperation): void => {
    const decision = input.decision;
    if (decision === "repair" || decision === "deliver") {
      if (report.status === "working" || report.status === "published" || report.status === "resolved") reject(409, "当前状态不能批准新执行。");
      const ceiling = this.env.SUPPORT_MAX_AUTHORITY ?? "analyze";
      if (!Object.hasOwn(authorityRank, ceiling) || authorityRank[decision] > authorityRank[ceiling]) reject(403, "超过当前环境允许的自动化范围。");
      report.approval = { inputVersion: report.inputVersion, authority: decision, reviewedAt: new Date().toISOString() };
      report.authority = decision;
      if (report.status !== "ready") report.status = "received";
    } else if (["needs-info", "reject", "revoke"].includes(decision ?? "")) {
      if (decision !== "revoke") textField(input.body, "评审意见", 4000);
      report.approval = null; report.authority = "analyze"; report.runId = null; delete report.fixedCommit;
      report.status = decision === "needs-info" ? "needs-info" : decision === "reject" ? "resolved" : "needs-decision";
    } else reject(400, "评审决定不正确。");
  };
}
