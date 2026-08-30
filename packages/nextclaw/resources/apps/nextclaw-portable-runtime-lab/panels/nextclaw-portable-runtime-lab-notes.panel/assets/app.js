const actionIds = {
  list: "nextclaw-portable-runtime-lab-state.records_list",
  upsert: "nextclaw-portable-runtime-lab-state.record_upsert",
  remove: "nextclaw-portable-runtime-lab-state.record_delete",
};

const elements = {
  form: document.querySelector("[data-note-form]"),
  input: document.querySelector("[data-note-input]"),
  search: document.querySelector("[data-search]"),
  count: document.querySelector("[data-note-count]"),
  characters: document.querySelector("[data-character-count]"),
  grid: document.querySelector("[data-notes-grid]"),
  notice: document.querySelector("[data-notice]"),
  revision: document.querySelector("[data-proof-revision]"),
};

let notes = [];

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

function noteCard(note, index) {
  const card = document.createElement("article");
  card.className = `note-card color-${index % 4}`;
  const content = document.createElement("p");
  content.textContent = note.title;
  const footer = document.createElement("footer");
  const version = document.createElement("span");
  version.textContent = `保存于版本 ${note.version}`;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.noteRemove = note.id;
  remove.textContent = "删除";
  footer.append(version, remove);
  card.append(content, footer);
  return card;
}

function render() {
  const query = elements.search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = [...notes]
    .sort((left, right) => right.version - left.version)
    .filter((note) => !query || note.title.toLocaleLowerCase("zh-CN").includes(query));
  elements.grid.replaceChildren();
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = query
      ? "<strong>没有找到相关便签</strong><span>换个关键词试试。</span>"
      : "<strong>便签盒还是空的</strong><span>写下刚刚想到的第一句话吧。</span>";
    elements.grid.append(empty);
  } else {
    filtered.forEach((note, index) => elements.grid.append(noteCard(note, index)));
  }
  elements.count.textContent = `${notes.length} 张便签`;
}

async function refresh() {
  const data = await invoke(actionIds.list);
  notes = (Array.isArray(data.records) ? data.records : [])
    .filter((record) => Array.isArray(record.tags) && record.tags.includes("note"));
  elements.revision.textContent = `revision ${data.revision} · ${data.contentHash}`;
  render();
}

async function run(operation, successMessage) {
  setNotice("正在保存…");
  try {
    await operation();
    await refresh();
    setNotice(successMessage, "success");
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error), "error");
  }
}

elements.input.addEventListener("input", () => {
  elements.characters.textContent = `${elements.input.value.length} / 800`;
});
elements.search.addEventListener("input", render);

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = elements.input.value.trim();
  if (!content) return;
  void run(async () => {
    await invoke(actionIds.upsert, {
      id: `note-${Date.now().toString(36)}`,
      title: content,
      status: "note",
      tags: ["note", "quick-capture"],
    });
    elements.input.value = "";
    elements.characters.textContent = "0 / 800";
  }, "便签已保存");
});

elements.grid.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const id = target?.closest("[data-note-remove]")?.dataset.noteRemove;
  if (id) void run(() => invoke(actionIds.remove, { id }), "便签已删除");
});

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
