const actionIds = {
  list: "nextclaw-portable-runtime-lab-state.records_list",
  upsert: "nextclaw-portable-runtime-lab-state.record_upsert",
  remove: "nextclaw-portable-runtime-lab-state.record_delete",
};

const elements = {
  form: document.querySelector("[data-todo-form]"),
  input: document.querySelector("[data-todo-input]"),
  list: document.querySelector("[data-todo-list]"),
  openCount: document.querySelector("[data-open-count]"),
  doneCount: document.querySelector("[data-done-count]"),
  notice: document.querySelector("[data-notice]"),
  revision: document.querySelector("[data-proof-revision]"),
};

let todos = [];

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

function setNotice(message, tone = "") {
  elements.notice.textContent = message;
  elements.notice.dataset.tone = tone;
}

function setBusy(busy) {
  for (const control of document.querySelectorAll("button, input")) control.disabled = busy;
}

function createTodoRow(todo) {
  const row = document.createElement("article");
  row.className = `todo-item${todo.status === "done" ? " is-done" : ""}`;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "check-button";
  toggle.dataset.todoToggle = todo.id;
  toggle.setAttribute("aria-label", todo.status === "done" ? "恢复任务" : "完成任务");
  toggle.textContent = todo.status === "done" ? "✓" : "";

  const title = document.createElement("p");
  title.textContent = todo.title;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-button";
  remove.dataset.todoRemove = todo.id;
  remove.setAttribute("aria-label", `删除 ${todo.title}`);
  remove.textContent = "删除";

  row.append(toggle, title, remove);
  return row;
}

function render() {
  const ordered = [...todos].sort((left, right) =>
    Number(left.status === "done") - Number(right.status === "done") ||
    right.version - left.version
  );
  elements.list.replaceChildren();
  if (ordered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = "<strong>今天还没有任务</strong><span>从上面添加第一件要做的事吧。</span>";
    elements.list.append(empty);
  } else {
    for (const todo of ordered) elements.list.append(createTodoRow(todo));
  }
  elements.openCount.textContent = String(todos.filter((todo) => todo.status !== "done").length);
  elements.doneCount.textContent = String(todos.filter((todo) => todo.status === "done").length);
}

async function refresh() {
  const data = await invoke(actionIds.list);
  todos = (Array.isArray(data.records) ? data.records : [])
    .filter((record) => Array.isArray(record.tags) && record.tags.includes("todo"));
  elements.revision.textContent = `revision ${data.revision} · ${data.contentHash}`;
  render();
}

async function run(operation, successMessage) {
  setBusy(true);
  setNotice("正在保存…");
  try {
    await operation();
    await refresh();
    setNotice(successMessage, "success");
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error), "error");
  } finally {
    setBusy(false);
    elements.input.focus();
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.input.value.trim();
  if (!title) return;
  void run(async () => {
    await invoke(actionIds.upsert, {
      id: `todo-${Date.now().toString(36)}`,
      title,
      status: "open",
      tags: ["todo", "daily"],
    });
    elements.input.value = "";
  }, "已加入今天的清单");
});

elements.list.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const toggleId = target?.closest("[data-todo-toggle]")?.dataset.todoToggle;
  const removeId = target?.closest("[data-todo-remove]")?.dataset.todoRemove;
  if (toggleId) {
    const todo = todos.find((entry) => entry.id === toggleId);
    if (!todo) return;
    void run(() => invoke(actionIds.upsert, {
      id: todo.id,
      title: todo.title,
      status: todo.status === "done" ? "open" : "done",
      tags: todo.tags,
    }), todo.status === "done" ? "任务已恢复" : "做得好，完成一件");
  }
  if (removeId) void run(() => invoke(actionIds.remove, { id: removeId }), "任务已删除");
});

document.querySelector("[data-refresh]").addEventListener("click", () => {
  void run(async () => undefined, "清单已刷新");
});

const now = new Date();
document.querySelector("[data-date-day]").textContent = String(now.getDate()).padStart(2, "0");
document.querySelector("[data-date-label]").textContent = now.toLocaleDateString("zh-CN", { month: "long", weekday: "short" });
void refresh().catch((error) => setNotice(error instanceof Error ? error.message : String(error), "error"));
async function refreshVerificationStatus() {
  const element = document.querySelector("[data-verification-status]");
  if (!element) return;
  try {
    const payload = await verificationRecords().list({ appId: "nextclaw.portable-runtime-lab", limit: 500 });
    const entry = (payload?.entries || []).find((candidate) => candidate.acceptanceId === "PRT-ENTRY-001");
    element.textContent = entry
      ? `${entry.status === "passed" ? "已有局部证据" : entry.status} · ${new Date(entry.finishedAt).toLocaleString()}`
      : "未验证（暂无 PRT-ENTRY-001 记录）";
  } catch {
    element.textContent = "暂时无法读取验收记录";
  }
}

void refreshVerificationStatus();
