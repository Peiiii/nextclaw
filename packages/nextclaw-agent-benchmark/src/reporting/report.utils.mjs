import { summarizeCalls, hash } from "#benchmark/measurement/usage.utils.mjs";
import { TASK_FIXTURES, fixtureIdentity } from "#benchmark/tasks/fixtures.config.mjs";

export const MATRIX_SCHEMA = "nextclaw.agent-benchmark/v1";
export const DEFAULT_TASKS = Object.keys(TASK_FIXTURES);

export function benchmarkSettings(taskIds = DEFAULT_TASKS) {
  return { model: "deepseek-v4-flash", endpoint: "https://api.deepseek.com", taskIds,
    environmentProfile: "clean-home-v1",
    fixtureHash: fixtureIdentity(taskIds), outputCaps: Object.fromEntries(taskIds.map((id) => [id, TASK_FIXTURES[id].maxOutputTokens])),
    thinking: "enabled/high (NextClaw provider default; DSH explicit)",
    includesFirstRequest: true, cacheDefinition: "sum(cached input tokens) / sum(input tokens)" };
}

export function aggregateCases(cases, taskIds) {
  return Object.fromEntries(["nextclaw", "dsh"].map((harness) => {
    const own = cases.filter((entry) => entry.harness === harness);
    const all = summarizeCalls(own.flatMap((entry) => entry.calls));
    const completedTasks = own.filter((entry) => entry.passed).length;
    const valid = own.length === taskIds.length && new Set(own.map((entry) => entry.taskId)).size === taskIds.length
      && taskIds.every((id) => own.some((entry) => entry.taskId === id))
      && completedTasks === taskIds.length && all.complete;
    return [harness, { ...all, totalTokens: all.inputTokens + all.outputTokens,
      uncachedInputTokens: all.inputTokens - all.cachedInputTokens,
      durationMs: own.length && own.every((entry) => Number.isFinite(entry.durationMs))
        ? own.reduce((sum, entry) => sum + entry.durationMs, 0) : null,
      modelRequestMs: own.reduce((sum, entry) => sum + entry.modelRequestMs, 0),
      completedTasks, expectedTasks: taskIds.length, valid,
      goldenCacheHitRate: valid ? all.cacheRate : null }];
  }));
}

export function compareMatrixReports(before, after) {
  if (before.schema !== MATRIX_SCHEMA || after.schema !== MATRIX_SCHEMA || hash(before.settings) !== hash(after.settings)) {
    throw new Error("Task versions, model or benchmark settings differ; direct regression comparison refused");
  }
  return Object.fromEntries(["nextclaw", "dsh"].map((harness) => {
    const left = before.totals[harness], right = after.totals[harness];
    const comparable = left.valid && right.valid;
    return [harness, { comparable, before: left.goldenCacheHitRate, after: right.goldenCacheHitRate,
      cacheRateDelta: comparable ? right.goldenCacheHitRate - left.goldenCacheHitRate : null,
      costUsdDelta: comparable ? right.estimatedCostUsd - left.estimatedCostUsd : null,
      totalTokenDelta: comparable ? right.totalTokens - left.totalTokens : null,
      durationMsDelta: comparable && Number.isFinite(left.durationMs) && Number.isFinite(right.durationMs)
        ? right.durationMs - left.durationMs : null }];
  }));
}

export function evaluateCostParity(totals) {
  const { nextclaw, dsh } = totals;
  const comparable = nextclaw.valid && dsh.valid && dsh.estimatedCostUsd > 0;
  const premium = comparable ? nextclaw.estimatedCostUsd / dsh.estimatedCostUsd - 1 : null;
  return { comparable, maximumPremium: 0.05, premium,
    passed: comparable && nextclaw.estimatedCostUsd <= dsh.estimatedCostUsd * 1.05 };
}

export function firstRequestCacheSensitivity(cases, total) {
  const first = cases.map((entry) => entry.calls[0]);
  if (!total.valid || !first.length || first.some((call) => !call?.tokens?.complete
    || !Number.isFinite(call.prices?.input) || !Number.isFinite(call.prices?.cached))) return null;
  return { firstRequestCachedTokens: first.reduce((sum, call) => sum + call.tokens.cached, 0),
    coldFirstRequestCostUsd: total.estimatedCostUsd + first.reduce((sum, call) =>
      sum + call.tokens.cached * (call.prices.input - call.prices.cached) / 1e6, 0) };
}

const percent = (value) => value === null ? "不可判定" : `${(value * 100).toFixed(2)}%`;
const cost = (value) => value === null ? "未知" : `$${value.toFixed(6)}`;
const seconds = (value) => value === null ? "未统一采集" : (value / 1000).toFixed(1);

export function renderReport(report) {
  const parity = evaluateCostParity(report.totals);
  const rows = Object.entries(report.totals).map(([name, total]) =>
    `| ${name} | ${total.completedTasks}/${total.expectedTasks} | ${percent(total.goldenCacheHitRate)} | ${cost(total.estimatedCostUsd)} | ${total.inputTokens} | ${total.cachedInputTokens} | ${total.outputTokens} | ${total.calls} | ${seconds(total.durationMs)} |`);
  const tasks = report.cases.map((entry) => `| ${TASK_FIXTURES[entry.taskId].label} | ${entry.harness} | ${entry.passed ? "通过" : "失败"} | ${percent(entry.all.cacheRate)} | ${cost(entry.all.estimatedCostUsd)} | ${seconds(entry.durationMs)} |`);
  const details = Object.entries(report.totals).map(([name, total]) =>
    `| ${name} | ${total.uncachedInputTokens} | ${total.reasoningTokens} | ${total.totalTokens} | ${seconds(total.modelRequestMs)} |`);
  const sensitivity = Object.entries(report.totals).map(([name, total]) => {
    const value = firstRequestCacheSensitivity(report.cases.filter((entry) => entry.harness === name), total);
    return `| ${name} | ${value?.firstRequestCachedTokens ?? "未知"} | ${cost(value?.coldFirstRequestCostUsd ?? null)} |`;
  });
  const executionPassed = report.executionPassed ?? (!report.failure && Object.values(report.totals).every((total) => total.valid));
  return `# Agent 真实任务基准\n\n运行：${report.runId}；任务执行：${executionPassed ? "通过" : "不完整或失败"}；成本验收：${parity.passed ? "通过" : "未通过"}。\n\n`
    + `核心指标为固定任务集全部输入 token 加权的缓存命中率，包含首次输入。任务失败或用量缺失时核心指标无效；失败用量仍保留。\n\n`
    + `成本验收：${parity.comparable ? `NextClaw 相对 DSH ${percent(parity.premium)}，${parity.passed ? "达到" : "未达到"}最多高 5% 的目标` : "任务或用量不完整，不可判定"}。任务执行通过不等于成本达标。\n\n`
    + `| Harness | 完成任务 | 核心命中率 | 估算费用 USD | 输入 token | 缓存输入 | 输出 token | 模型调用 | 总耗时 秒 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows.join("\n")}\n\n`
    + `| Harness | 未缓存输入 | 思考 token（已含于输出） | 总 token | API 累计秒 |\n|---|---:|---:|---:|---:|\n${details.join("\n")}\n\n`
    + `本地隔离不清空供应商缓存。以下只将每项首请求的缓存输入改按未命中价重算，保留其余观测；是敏感性估算，不是真实冷启动复测，也不替换核心成绩。\n\n| Harness | 首请求缓存 token 合计 | 首请求全冷估算 USD |\n|---|---:|---:|\n${sensitivity.join("\n")}\n\n`
    + `| 任务 | Harness | 验收 | 任务命中率 | 估算费用 USD | 耗时 秒 |\n|---|---|---|---:|---:|---:|\n${tasks.join("\n")}\n\n`
    + `费用是供应商原始 usage 乘以带日期的价格快照，不是账单实扣。输出含思考 token，不能再次相加。任务耗时包含启动、执行、关闭和外部验收；模型请求耗时单独保留在 JSON。\n\n`
    + `任务版本与输出上限：\`${JSON.stringify(report.settings.outputCaps)}\`；任务指纹：\`${report.settings.fixtureHash}\`。\n\n`
    + `完整报告： [report.json](./report.json)。每项任务的 case JSON 保存每次 API 调用、结束原因、用量、时间、验收与失败原因。\n\n`
    + (report.assemblyNote ? `${report.assemblyNote}\n\n` : "")
    + (report.failure ? `运行异常：${report.failure}\n\n` : "")
    + `这三类小型任务用于低成本回归监控，不代表大型代码库修复、长上下文压缩或公开排行榜成绩。\n`;
}

export function renderStagedReport(report) {
  const number = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
  const table = (headers, rows) => `| ${headers.join(" | ")} |\n|${headers.map(() => "---").join("|")}|\n`
    + rows.map((row) => `| ${row.join(" | ")} |`).join("\n") + "\n\n";
  const totals = Object.entries(report.totals).filter(([, total]) => total);
  const summary = totals.map(([id, total]) => [id, `${total.completedTasks}/${total.expectedTasks}`,
    total.valid ? number(total.cacheRate * 100) + "%" : "无有效核心成绩", number(total.estimatedCostUsd, 9),
    total.inputTokens, total.cachedInputTokens, total.uncachedInputTokens, total.outputTokens, total.reasoningTokens,
    total.totalTokens, number(total.durationMs / 1000), number(total.modelRequestMs / 1000), total.calls, total.prefixRewrites]);
  const changes = Object.entries(report.changes).flatMap(([id, comparisons]) => Object.entries(comparisons)
    .filter(([, metrics]) => metrics).map(([baseline, metrics]) => [id, baseline,
      number(metrics.estimatedCostUsd.relative * 100) + "%", number(metrics.cacheRate.delta * 100) + " pp",
      number(metrics.totalTokens.relative * 100) + "%", number(metrics.durationMs.relative * 100) + "%",
      metrics.calls.delta]));
  return "# 五阶段累计实验\n\n同一任务集、输出上限与隔离规范，单次观测；差值不是统计显著性或独立因果效应。失败不剔除。\n\n"
    + table(["阶段", "通过", "核心缓存", "费用 USD", "输入", "缓存输入", "未缓存输入", "输出", "思考", "总 token", "耗时秒", "API秒", "调用", "前缀改写"], summary)
    + table(["阶段", "对照", "费用变化", "缓存变化", "总 token 变化", "耗时变化", "调用变化"], changes)
    + table(["阶段", "任务", "通过", "费用 USD", "输入", "输出", "缓存比例", "耗时秒", "调用"], report.cases.map((c) => [
      c.variant, c.taskId, c.passed, number(c.all.estimatedCostUsd, 9), c.all.inputTokens, c.all.outputTokens,
      number(c.all.cacheRate * 100) + "%", number(c.durationMs / 1000), c.all.calls]))
    + `实际用量估算合计 USD ${number(report.budget.used, 9)}；请求 ${report.budget.calls}；预算 USD ${report.budget.limit}。\n`;
}
