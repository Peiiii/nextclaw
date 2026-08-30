const actionIds = {
  compose: "nextclaw-portable-runtime-lab-composition.compose_contact",
  providerStatus: "nextclaw-portable-runtime-lab-provider.provider_status",
};

const elements = {
  form: document.querySelector("[data-contact-form]"),
  name: document.querySelector("[data-name]"),
  email: document.querySelector("[data-email]"),
  tags: document.querySelector("[data-tags]"),
  card: document.querySelector("[data-contact-card]"),
  placeholder: document.querySelector("[data-placeholder]"),
  avatar: document.querySelector("[data-avatar]"),
  displayName: document.querySelector("[data-display-name]"),
  displayEmail: document.querySelector("[data-display-email]"),
  displayTags: document.querySelector("[data-display-tags]"),
  copy: document.querySelector("[data-copy]"),
  notice: document.querySelector("[data-notice]"),
  count: document.querySelector("[data-proof-count]"),
};

let latestContact = null;

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

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function render(result) {
  const provider = result.provider ?? {};
  latestContact = {
    name: provider.normalizedName ?? "",
    email: provider.normalizedEmail ?? "",
    tags: Array.isArray(provider.normalizedTags) ? provider.normalizedTags : [],
  };
  elements.placeholder.hidden = true;
  elements.card.hidden = false;
  elements.avatar.textContent = initials(latestContact.name);
  elements.displayName.textContent = latestContact.name;
  elements.displayEmail.textContent = latestContact.email;
  elements.displayEmail.href = `mailto:${latestContact.email}`;
  elements.displayTags.replaceChildren();
  for (const tag of latestContact.tags) {
    const chip = document.createElement("span");
    chip.textContent = tag;
    elements.displayTags.append(chip);
  }
  elements.count.textContent = `${provider.providerCallCount ?? "—"} 次`;
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.notice.textContent = "正在整理…";
  elements.notice.dataset.tone = "";
  void invoke(actionIds.compose, {
    name: elements.name.value,
    email: elements.email.value,
    tags: elements.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
  }).then((result) => {
    render(result);
    elements.notice.textContent = "姓名空格、邮箱大小写和重复标签都已整理";
    elements.notice.dataset.tone = "success";
  }).catch((error) => {
    elements.notice.textContent = error instanceof Error ? error.message : String(error);
    elements.notice.dataset.tone = "error";
  });
});

elements.copy.addEventListener("click", () => {
  if (!latestContact) return;
  const text = `${latestContact.name} <${latestContact.email}>${latestContact.tags.length ? ` · ${latestContact.tags.join(", ")}` : ""}`;
  void navigator.clipboard.writeText(text).then(() => {
    elements.notice.textContent = "联系人已复制";
    elements.notice.dataset.tone = "success";
  }).catch(() => {
    elements.notice.textContent = text;
  });
});

void invoke(actionIds.providerStatus).then((status) => {
  elements.count.textContent = `${status.providerCallCount ?? 0} 次`;
}).catch(() => undefined);
async function refreshVerificationStatus() {
  const element = document.querySelector("[data-verification-status]");
  if (!element) return;
  try {
    const payload = await verificationRecords().list({ appId: "nextclaw.portable-runtime-lab", limit: 500 });
    const entry = (payload?.entries || []).find((candidate) => candidate.acceptanceId === "PRT-COMP-001");
    element.textContent = entry
      ? `${entry.status === "passed" ? "已有局部证据" : entry.status} · ${new Date(entry.finishedAt).toLocaleString()}`
      : "未验证（暂无 PRT-COMP-001 记录）";
  } catch {
    element.textContent = "暂时无法读取验收记录";
  }
}

void refreshVerificationStatus();
