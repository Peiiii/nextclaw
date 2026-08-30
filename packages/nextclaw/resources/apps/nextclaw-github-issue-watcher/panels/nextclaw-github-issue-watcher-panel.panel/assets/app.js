const actions = {
  sync: "nextclaw-github-issue-watcher-service.issues_sync",
  list: "nextclaw-github-issue-watcher-service.issues_list",
};

const elements = {
  form: document.querySelector("[data-sync-form]"),
  repository: document.querySelector("[data-repository]"),
  sync: document.querySelector("[data-sync]"),
  refresh: document.querySelector("[data-refresh]"),
  state: document.querySelector("[data-state]"),
  notice: document.querySelector("[data-notice]"),
  repositorySummary: document.querySelector("[data-repository-summary]"),
  syncTime: document.querySelector("[data-sync-time]"),
  count: document.querySelector("[data-count]"),
  issues: document.querySelector("[data-issues]"),
};

function serviceActions() {
  const bridge = window.nextclaw?.serviceActions;
  if (!bridge) throw new Error("应用还没有连接到 NextClaw，请刷新后重试。");
  return bridge;
}

async function invoke(action, input = {}) {
  return await serviceActions().invoke(action, input);
}

function setNotice(message = "", tone = "") {
  elements.notice.textContent = message;
  elements.notice.dataset.tone = tone;
}

function setBusy(busy) {
  elements.sync.disabled = busy;
  elements.refresh.disabled = busy;
  elements.repository.disabled = busy;
  elements.state.disabled = busy;
}

function formatTime(epochMs) {
  if (!Number.isFinite(Number(epochMs))) return "";
  return `上次同步：${new Date(Number(epochMs)).toLocaleString("zh-CN")}`;
}

function issueRow(issue) {
  const row = document.createElement("li");
  row.className = "issue";
  const link = document.createElement("a");
  link.href = typeof issue.url === "string" ? issue.url : "#";
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = `#${issue.number ?? "—"} ${issue.title || "未命名 Issue"}`;
  const meta = document.createElement("div");
  meta.className = "meta";
  for (const text of [
    issue.state === "closed" ? "已关闭" : "打开",
    issue.author ? `@${issue.author}` : "",
    issue.updatedAt
      ? `更新于 ${new Date(issue.updatedAt).toLocaleString("zh-CN")}`
      : "",
  ].filter(Boolean)) {
    const item = document.createElement("span");
    item.textContent = text;
    meta.append(item);
  }
  for (const label of Array.isArray(issue.labels) ? issue.labels : []) {
    const chip = document.createElement("span");
    chip.className = "label";
    chip.textContent = label;
    meta.append(chip);
  }
  row.append(link, meta);
  return row;
}

function render(snapshot) {
  const issues = Array.isArray(snapshot?.issues) ? snapshot.issues : [];
  if (snapshot?.repository && !elements.repository.value.trim())
    elements.repository.value = snapshot.repository;
  elements.repositorySummary.textContent = snapshot?.repository
    ? `${snapshot.repository} · ${snapshot.filter || elements.state.value}`
    : "还没有同步仓库";
  elements.syncTime.textContent = formatTime(snapshot?.syncedAtEpochMs);
  elements.count.textContent = `${issues.length} 条 Issue`;
  elements.issues.replaceChildren();
  if (issues.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = snapshot?.message || "这个筛选条件下暂时没有 Issue。";
    elements.issues.append(empty);
    return;
  }
  for (const issue of issues) elements.issues.append(issueRow(issue));
}

async function refresh() {
  const snapshot = await invoke(actions.list, { state: elements.state.value });
  render(snapshot);
  return snapshot;
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const repository = elements.repository.value.trim();
  if (!repository) {
    setNotice("先输入 GitHub 仓库，例如 owner/repository。", "error");
    elements.repository.focus();
    return;
  }
  setBusy(true);
  setNotice("正在从 GitHub 同步…");
  void invoke(actions.sync, { repository })
    .then(async (result) => {
      await refresh();
      setNotice(`已同步 ${result.issueCount ?? 0} 条 Issue。`, "success");
    })
    .catch((error) =>
      setNotice(
        error instanceof Error ? error.message : String(error),
        "error",
      ),
    )
    .finally(() => setBusy(false));
});

elements.refresh.addEventListener("click", () => {
  setBusy(true);
  void refresh()
    .then(() => setNotice("列表已刷新。", "success"))
    .catch((error) =>
      setNotice(
        error instanceof Error ? error.message : String(error),
        "error",
      ),
    )
    .finally(() => setBusy(false));
});

elements.state.addEventListener("change", () => {
  void refresh().catch((error) =>
    setNotice(error instanceof Error ? error.message : String(error), "error"),
  );
});

void refresh().catch((error) =>
  setNotice(error instanceof Error ? error.message : String(error), "error"),
);
