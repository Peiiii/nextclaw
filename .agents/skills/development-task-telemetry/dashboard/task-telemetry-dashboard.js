const REFRESH_INTERVAL_MS = 15_000;
const numberFormatter = new Intl.NumberFormat("zh-CN");
const compactFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const elements = {
  cacheRatio: document.querySelector("#cache-ratio"),
  cacheRatioDetail: document.querySelector("#cache-ratio-detail"),
  coverage: document.querySelector("#coverage"),
  coverageDetail: document.querySelector("#coverage-detail"),
  error: document.querySelector("#error"),
  modelList: document.querySelector("#model-list"),
  notice: document.querySelector("#notice"),
  observedTokens: document.querySelector("#observed-tokens"),
  observedTokensDetail: document.querySelector("#observed-tokens-detail"),
  phaseList: document.querySelector("#phase-list"),
  refreshButton: document.querySelector("#refresh-button"),
  refreshState: document.querySelector(".refresh-state"),
  refreshStateText: document.querySelector("#refresh-state-text"),
  sourceSummary: document.querySelector("#source-summary"),
  taskChildLanes: document.querySelector("#task-child-lanes"),
  taskCount: document.querySelector("#task-count"),
  taskCountDetail: document.querySelector("#task-count-detail"),
  taskDetailContent: document.querySelector("#task-detail-content"),
  taskDetailEmpty: document.querySelector("#task-detail-empty"),
  taskDetailId: document.querySelector("#task-detail-id"),
  taskDetailTitle: document.querySelector("#task-detail-title"),
  taskListCount: document.querySelector("#task-list-count"),
  taskModelCalls: document.querySelector("#task-model-calls"),
  taskQuality: document.querySelector("#task-quality"),
  taskTableBody: document.querySelector("#task-table-body"),
  taskToolRounds: document.querySelector("#task-tool-rounds"),
  usageBreakdown: document.querySelector("#usage-breakdown"),
  warningCount: document.querySelector("#warning-count"),
  warningList: document.querySelector("#warning-list"),
  workspaceLabel: document.querySelector("#workspace-label"),
};

const statusLabels = {
  blocked: "阻塞",
  cancelled: "已取消",
  completed: "完成",
  failed: "失败",
  incomplete: "进行中",
};
const qualityLabels = {
  complete: "数据完整",
  partial: "部分数据",
  unavailable: "数据不可用",
};
const phaseLabels = {
  "task-understanding": "任务理解",
  design: "设计",
  implementation: "实现",
  validation: "验证",
  review: "Review",
  delivery: "交付",
  retrospective: "复盘",
};

let currentSnapshot = null;
let selectedTaskId = null;
let refreshInFlight = false;

function formatExact(value) {
  return numberFormatter.format(value ?? 0);
}

function formatCompact(value) {
  return compactFormatter.format(value ?? 0);
}

function formatPercent(value) {
  return value === null || value === undefined
    ? "不可用"
    : `${(value * 100).toFixed(2)}%`;
}

function formatDuration(value) {
  if (value === null || value === undefined) return "进行中";
  if (value < 1_000) return `${value} ms`;
  const seconds = value / 1_000;
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${Math.round(seconds % 60)} 秒`;
}

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function formatTokenValue(value) {
  return {
    compact: formatCompact(value),
    exact: `${formatExact(value)} Token`,
  };
}

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderOverview(snapshot) {
  const { corpus, tasks } = snapshot.report;
  const usage = corpus.observed_usage;
  const attributed = corpus.attributed_usage.total_tokens;
  const completedTasks = tasks.filter(
    (task) => task.status === "completed",
  ).length;
  const inputTokens = usage.input_tokens;
  const cacheRatio =
    inputTokens === 0 ? null : usage.cached_input_tokens / inputTokens;
  const uncachedInput = Math.max(0, inputTokens - usage.cached_input_tokens);

  const observedTokens = formatTokenValue(usage.total_tokens);
  elements.observedTokens.textContent = observedTokens.compact;
  elements.observedTokens.title = observedTokens.exact;
  elements.observedTokensDetail.textContent = `输出 ${formatCompact(usage.output_tokens)} · 推理 ${formatCompact(usage.reasoning_output_tokens)}`;
  elements.coverage.textContent = formatPercent(corpus.mechanical_coverage);
  elements.coverageDetail.textContent = `已归因 ${formatCompact(attributed)} Token`;
  elements.taskCount.textContent = formatExact(tasks.length);
  elements.taskCountDetail.textContent = `已完成 ${completedTasks} · 进行中 ${tasks.length - completedTasks}`;
  elements.cacheRatio.textContent = formatPercent(cacheRatio);
  elements.cacheRatioDetail.textContent = `未缓存输入 ${formatCompact(uncachedInput)}`;
  elements.workspaceLabel.textContent = snapshot.meta.workspace;
  elements.workspaceLabel.title = snapshot.meta.workspace;

  if (usage.total_tokens > 0 && corpus.mechanical_coverage === 0) {
    elements.notice.hidden = false;
    elements.notice.textContent =
      "日志可以读取，但当前没有可归因任务。总量仍然可信，阶段和任务拆分保持为空。";
  } else if (snapshot.report.warnings.length > 0) {
    elements.notice.hidden = false;
    elements.notice.textContent =
      "部分日志存在边界或用量数据警告。请结合覆盖率和警告列表判断数据质量。";
  } else {
    elements.notice.hidden = true;
  }
}

function sortedTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftTimestamp = Date.parse(left.started_at ?? 0);
    const rightTimestamp = Date.parse(right.started_at ?? 0);
    return rightTimestamp - leftTimestamp || left.id.localeCompare(right.id);
  });
}

function renderTaskTable(tasks) {
  const orderedTasks = sortedTasks(tasks);
  if (!orderedTasks.some((task) => task.id === selectedTaskId)) {
    selectedTaskId = orderedTasks[0]?.id ?? null;
  }
  elements.taskListCount.textContent = formatExact(orderedTasks.length);
  elements.taskTableBody.replaceChildren();

  if (orderedTasks.length === 0) {
    const row = document.createElement("tr");
    const cell = makeElement(
      "td",
      "empty-table-cell",
      "还没有完整的开发任务标记。",
    );
    cell.colSpan = 6;
    row.append(cell);
    elements.taskTableBody.append(row);
    renderTaskDetail(null);
    return;
  }

  for (const task of orderedTasks) {
    const row = document.createElement("tr");
    if (task.id === selectedTaskId) row.classList.add("is-selected");

    const taskCell = document.createElement("td");
    const selectButton = makeElement("button", "task-select-button");
    selectButton.type = "button";
    selectButton.append(
      makeElement("span", "task-name", task.name ?? "未命名任务"),
      makeElement("code", "task-id", task.id),
    );
    selectButton.setAttribute(
      "aria-pressed",
      String(task.id === selectedTaskId),
    );
    selectButton.addEventListener("click", () => {
      selectedTaskId = task.id;
      renderTaskTable(currentSnapshot.report.tasks);
    });
    taskCell.append(selectButton);

    const statusCell = document.createElement("td");
    statusCell.append(
      makeElement(
        "span",
        `status-chip status-${task.status}`,
        statusLabels[task.status] ?? task.status,
      ),
    );

    const tokenCell = makeElement(
      "td",
      "",
      formatCompact(task.total_usage.total_tokens),
    );
    tokenCell.title = `${formatExact(task.total_usage.total_tokens)} Token`;
    row.append(
      taskCell,
      statusCell,
      tokenCell,
      makeElement("td", "", formatPercent(task.mechanical_coverage)),
      makeElement("td", "", formatDuration(task.task_elapsed_ms)),
      makeElement("td", "", formatDate(task.started_at)),
    );
    elements.taskTableBody.append(row);
  }

  renderTaskDetail(orderedTasks.find((task) => task.id === selectedTaskId));
}

function renderTaskDetail(task) {
  if (!task) {
    elements.taskDetailTitle.textContent = "尚未选择任务";
    elements.taskDetailId.textContent = "—";
    elements.taskQuality.textContent = "—";
    elements.taskQuality.className = "status-chip status-neutral";
    elements.taskDetailEmpty.hidden = false;
    elements.taskDetailContent.hidden = true;
    return;
  }

  elements.taskDetailTitle.textContent = task.name ?? "未命名任务";
  elements.taskDetailId.textContent = task.id;
  elements.taskQuality.textContent =
    qualityLabels[task.data_quality] ?? task.data_quality;
  elements.taskQuality.className = `status-chip status-${task.status}`;
  elements.taskDetailEmpty.hidden = true;
  elements.taskDetailContent.hidden = false;
  elements.taskModelCalls.textContent = formatExact(task.model_calls);
  elements.taskToolRounds.textContent = formatExact(task.tool_call_rounds);
  elements.taskChildLanes.textContent = formatExact(task.child_lane_count);

  elements.phaseList.replaceChildren();
  for (const phase of task.phases) {
    const item = makeElement("div", "bar-item");
    const label = makeElement("div", "bar-label");
    label.append(
      makeElement("span", "", phaseLabels[phase.phase] ?? phase.phase),
      makeElement(
        "span",
        "",
        `${formatCompact(phase.total_usage.total_tokens)} · ${formatPercent(phase.share_of_task_tokens)}`,
      ),
    );
    const track = makeElement("div", "bar-track");
    const fill = makeElement("div", "bar-fill");
    fill.style.width = `${Math.max(0, Math.min(100, (phase.share_of_task_tokens ?? 0) * 100))}%`;
    track.append(fill);
    item.append(label, track);
    elements.phaseList.append(item);
  }
  if (task.phases.length === 0) {
    elements.phaseList.append(
      makeElement("p", "empty-state", "暂无阶段数据。"),
    );
  }

  elements.modelList.replaceChildren();
  for (const model of task.models) {
    const item = makeElement("div", "model-row");
    const name = makeElement(
      "span",
      "model-name",
      `${model.model} / ${model.effort}`,
    );
    name.title = `${model.model} / ${model.effort}`;
    item.append(
      name,
      makeElement(
        "span",
        "",
        `${formatExact(model.model_calls)} 次 · ${formatCompact(model.total_tokens)}`,
      ),
    );
    elements.modelList.append(item);
  }
}

function renderUsage(usage) {
  const rows = [
    ["Input Token", usage.input_tokens],
    ["Cached Input", usage.cached_input_tokens],
    [
      "Uncached Input",
      Math.max(0, usage.input_tokens - usage.cached_input_tokens),
    ],
    ["Output Token", usage.output_tokens],
    ["Reasoning Output", usage.reasoning_output_tokens],
  ];
  elements.usageBreakdown.replaceChildren();
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.append(
      makeElement("dt", "", label),
      makeElement("dd", "", formatExact(value)),
    );
    elements.usageBreakdown.append(row);
  }
}

function renderWarnings(warnings) {
  const counts = new Map();
  for (const warning of warnings) {
    counts.set(warning.code, (counts.get(warning.code) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  elements.warningCount.textContent = formatExact(warnings.length);
  elements.warningList.replaceChildren();
  if (ordered.length === 0) {
    elements.warningList.append(
      makeElement("div", "empty-state", "当前报告没有数据质量警告。"),
    );
    return;
  }
  for (const [code, count] of ordered) {
    const row = makeElement("div", "warning-row");
    row.append(
      makeElement("span", "warning-code", code),
      makeElement("span", "warning-count-value", formatExact(count)),
    );
    elements.warningList.append(row);
  }
}

function render(snapshot) {
  currentSnapshot = snapshot;
  renderOverview(snapshot);
  renderTaskTable(snapshot.report.tasks);
  renderUsage(snapshot.report.corpus.observed_usage);
  renderWarnings(snapshot.report.warnings);
  elements.sourceSummary.textContent =
    `自 ${snapshot.meta.history_start} 起匹配 ${snapshot.meta.matched_rollout_count} / ${snapshot.meta.eligible_rollout_count} 个会话日志` +
    `（全部 ${snapshot.meta.scanned_rollout_count}）· 本次解析 ${snapshot.meta.parsed_rollout_count} 个 · ` +
    `分析 ${snapshot.meta.analysis_ms} ms${snapshot.meta.cache_hit ? " · 无新日志" : ""}`;
}

async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "刷新中…";
  elements.refreshState.classList.add("is-loading");
  elements.refreshStateText.textContent = "正在读取新日志…";
  elements.error.hidden = true;
  try {
    const response = await fetch("/api/report", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "统计服务返回错误");
    render(payload);
    elements.refreshStateText.textContent = `更新于 ${formatDate(payload.meta.generated_at)}`;
  } catch (error) {
    elements.error.hidden = false;
    elements.error.textContent = `无法刷新统计：${error instanceof Error ? error.message : String(error)}`;
    elements.refreshStateText.textContent = "刷新失败";
  } finally {
    refreshInFlight = false;
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "立即刷新";
    elements.refreshState.classList.remove("is-loading");
  }
}

elements.refreshButton.addEventListener("click", () => void refresh());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refresh();
});
setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
void refresh();
