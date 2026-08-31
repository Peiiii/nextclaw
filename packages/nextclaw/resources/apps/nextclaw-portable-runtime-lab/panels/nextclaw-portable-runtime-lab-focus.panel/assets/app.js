const actionIds = {
  status: "nextclaw-portable-runtime-lab-resident.resident_status",
  reset: "nextclaw-portable-runtime-lab-resident.resident_reset",
  milestone: "nextclaw-portable-runtime-lab-resident.resident_emit_event",
  recordsList: "nextclaw-portable-runtime-lab-state.records_list",
  recordUpsert: "nextclaw-portable-runtime-lab-state.record_upsert",
};

const elements = {
  clock: document.querySelector("[data-clock]"),
  caption: document.querySelector("[data-clock-caption]"),
  milestones: document.querySelector("[data-milestones]"),
  notice: document.querySelector("[data-notice]"),
  epoch: document.querySelector("[data-proof-epoch]"),
  events: document.querySelector("[data-proof-events]"),
};

function serviceActions() {
  const bridge = window.nextclaw?.serviceActions;
  if (!bridge) throw new Error("应用还没有连接到 NextClaw，请刷新后重试。");
  return bridge;
}

function verificationRecords() {
  const bridge = window.nextclaw?.verificationRecords;
  if (!bridge) throw new Error("验收记录桥尚未就绪。");
  return bridge;
}

async function invoke(actionId, input = {}) {
  return await serviceActions().invoke(actionId, input);
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function milestoneTime(record) {
  const timestamp = Number(String(record.id).replace("focus-", ""));
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function renderMilestones(records) {
  const items = (Array.isArray(records) ? records : [])
    .filter((record) => Array.isArray(record.tags) && record.tags.includes("focus-milestone"))
    .sort((left, right) => (milestoneTime(right)?.getTime() ?? 0) - (milestoneTime(left)?.getTime() ?? 0));
  elements.milestones.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "还没有完成点";
    elements.milestones.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("li");
    const dot = document.createElement("i");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title || "完成了一个阶段";
    const time = document.createElement("span");
    const occurredAt = milestoneTime(item);
    time.textContent = occurredAt
      ? occurredAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : `数据版本 ${item.version}`;
    copy.append(title, time);
    row.append(dot, copy);
    elements.milestones.append(row);
  }
}

async function refresh() {
  const [state, records] = await Promise.all([
    invoke(actionIds.status),
    invoke(actionIds.recordsList),
  ]);
  elements.clock.textContent = formatDuration(state.eventCount);
  elements.caption.textContent = state.eventCount > 0 ? "本轮专注仍在后台继续" : "准备好后，开始一轮新的专注";
  elements.epoch.textContent = `第 ${state.instanceEpoch} 次运行实例`;
  elements.events.textContent = `${state.eventCount} 个持久事件`;
  renderMilestones(records.records);
  if (elements.notice.dataset.tone === "error") {
    elements.notice.textContent = "";
    elements.notice.dataset.tone = "";
  }
  return state;
}

async function run(operation, successMessage) {
  elements.notice.textContent = "正在更新…";
  elements.notice.dataset.tone = "";
  try {
    await operation();
    await refresh();
    elements.notice.textContent = successMessage;
    elements.notice.dataset.tone = "success";
  } catch (error) {
    elements.notice.textContent = error instanceof Error ? error.message : String(error);
    elements.notice.dataset.tone = "error";
  }
}

document.querySelector("[data-start]").addEventListener("click", () => {
  void run(() => invoke(actionIds.reset), "新一轮专注已经开始，关闭页面也会继续");
});
document.querySelector("[data-milestone]").addEventListener("click", () => {
  const now = new Date();
  const eventId = `focus-${now.getTime()}`;
  void run(async () => {
    await invoke(actionIds.milestone, {
      eventId,
      kind: "focus-milestone",
      triggeredAt: now.toISOString(),
    });
    await invoke(actionIds.recordUpsert, {
      id: eventId,
      title: "完成了一个阶段",
      status: "completed",
      tags: ["focus-milestone", "focus"],
    });
  }, "已经记下这个完成点，并保存到专注历史");
});
document.querySelector("[data-refresh]").addEventListener("click", () => void refresh());

void refresh().catch((error) => {
  elements.notice.textContent = error instanceof Error ? error.message : String(error);
  elements.notice.dataset.tone = "error";
});
const poll = window.setInterval(() => {
  if (document.visibilityState === "visible") void refresh();
}, 1000);
window.addEventListener("pagehide", () => window.clearInterval(poll), { once: true });
async function refreshVerificationStatus() {
  const element = document.querySelector("[data-verification-status]");
  if (!element) return;
  try {
    const payload = await verificationRecords().list({ appId: "nextclaw.portable-runtime-lab", limit: 500 });
    const entry = (payload?.entries || []).find((candidate) => candidate.acceptanceId === "PRT-RES-001");
    element.textContent = entry
      ? `${entry.status === "passed" ? "已有局部证据" : entry.status} · ${new Date(entry.finishedAt).toLocaleString()}`
      : "未验证（暂无 PRT-RES-001 记录）";
  } catch {
    element.textContent = "暂时无法读取验收记录";
  }
}

void refreshVerificationStatus();
