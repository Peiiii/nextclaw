const actions = {
  counterRead: "nextclaw-portable-runtime-lab-state.counter_read",
  counterIncrement: "nextclaw-portable-runtime-lab-state.counter_increment",
  recordsSeed: "nextclaw-portable-runtime-lab-state.records_seed",
  recordsList: "nextclaw-portable-runtime-lab-state.records_list",
  recordUpsert: "nextclaw-portable-runtime-lab-state.record_upsert",
  recordDelete: "nextclaw-portable-runtime-lab-state.record_delete",
  dataSnapshot: "nextclaw-portable-runtime-lab-state.data_snapshot",
  stateRuntime: "nextclaw-portable-runtime-lab-state.runtime_info",
  networkAllowed: "nextclaw-portable-runtime-lab-capabilities.network_allowed",
  networkDenied: "nextclaw-portable-runtime-lab-capabilities.network_denied",
  structuredFailure: "nextclaw-portable-runtime-lab-capabilities.structured_failure",
  timeout: "nextclaw-portable-runtime-lab-capabilities.simulate_timeout",
  capabilityRuntime: "nextclaw-portable-runtime-lab-capabilities.runtime_info",
  residentStatus: "nextclaw-portable-runtime-lab-resident.resident_status",
  residentEmitEvent: "nextclaw-portable-runtime-lab-resident.resident_emit_event",
  residentReset: "nextclaw-portable-runtime-lab-resident.resident_reset",
  providerStatus: "nextclaw-portable-runtime-lab-provider.provider_status",
  composeContact: "nextclaw-portable-runtime-lab-composition.compose_contact",
  providerDenied: "nextclaw-portable-runtime-lab-composition.provider_denied",
};

const APP_ID = "nextclaw.portable-runtime-lab";
const verificationElements = {
  root: document.querySelector(".verification"),
  list: document.querySelector("[data-verification-list]"),
  app: document.querySelector("[data-verification-app]"),
  runtime: document.querySelector("[data-verification-runtime]"),
  count: document.querySelector("[data-verification-count]"),
  environment: document.querySelector("[data-verification-environment]"),
  implementation: document.querySelector("[data-verification-implementation]"),
  contract: document.querySelector("[data-verification-contract]"),
  sources: document.querySelector("[data-verification-sources]"),
  evidence: document.querySelector("[data-verification-evidence]"),
};

let acceptanceStatus = null;

const statusLabels = {
  "current-passed": "当前通过",
  failed: "失败",
  stale: "证据已过期",
  missing: "尚无证据",
  "not-applicable": "当前平台不适用",
};

const categoryLabels = {
  execution: "执行",
  capability: "基础能力",
  lifecycle: "生命周期",
  entry: "入口",
  quality: "质量与交付",
  release: "发布",
};

async function fetchAcceptanceStatus() {
  const payload = await portableRuntimeAcceptance().status({ locale: "zh-CN" });
  if (!Array.isArray(payload?.entries) || !payload?.contract || !payload?.identity) {
    throw new Error("验收状态返回格式无效。");
  }
  return payload;
}

function portableRuntimeAcceptance() {
  const bridge = window.nextclaw?.portableRuntimeAcceptance;
  if (!bridge) throw new Error("NextClaw 验收桥尚未就绪，请刷新后重试。");
  return bridge;
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function renderVerificationList() {
  verificationElements.list.replaceChildren();
  const groups = new Map();
  for (const entry of acceptanceStatus.entries) {
    const group = groups.get(entry.category) || [];
    group.push(entry);
    groups.set(entry.category, group);
  }
  for (const [category, entries] of groups) {
    const group = document.createElement("section");
    group.className = "verification-category";
    const groupHeading = document.createElement("h3");
    groupHeading.textContent = categoryLabels[category] || category;
    group.append(groupHeading);
    const cards = document.createElement("div");
    cards.className = "verification-category-cards";
    for (const item of entries) {
      const acceptanceId = item.id;
      const evidence = item.result.latestRecord;
      const status = item.result.status;
      const card = document.createElement("article");
      card.className = "verification-item";
      card.dataset.status = status;

      const heading = document.createElement("div");
      heading.className = "verification-item-heading";
    const titleBlock = document.createElement("div");
    const id = document.createElement("code");
    id.textContent = acceptanceId;
    const name = document.createElement("h3");
    name.textContent = item.presentation.title;
    const copy = document.createElement("p");
    copy.textContent = item.presentation.description;
    titleBlock.append(id, name, copy);
    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.textContent = statusLabels[status] || status;
    heading.append(titleBlock, badge);
      card.append(heading);

    const meta = document.createElement("dl");
    meta.className = "verification-meta";
    for (const [label, value] of [
      ["最近运行", formatTime(evidence?.finishedAt)],
      ["环境", evidence?.environment || acceptanceStatus.identity.environment || "尚未验证"],
      ["来源", item.evidenceSource],
      ["动作", evidence?.actionOrEvent || "尚未验证"],
    ]) {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = value;
      wrapper.append(term, detail);
      meta.append(wrapper);
    }
      card.append(meta);

    const controls = document.createElement("div");
    controls.className = "verification-controls";
    if (evidence) {
      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "text-button";
      viewButton.dataset.viewEvidence = evidence.verificationRunId;
      viewButton.textContent = "查看证据";
      controls.append(viewButton);
    } else {
      const note = document.createElement("span");
      note.className = "verification-note";
      note.textContent = "尚无可展示的当前证据";
      controls.append(note);
    }
      card.append(controls);
      cards.append(card);
    }
    group.append(cards);
    verificationElements.list.append(group);
  }
}

async function refreshVerification() {
  verificationElements.root.dataset.state = "pending";
  try {
    acceptanceStatus = await fetchAcceptanceStatus();
    const { identity, contract, summary } = acceptanceStatus;
    verificationElements.app.textContent = acceptanceStatus.appId;
    verificationElements.runtime.textContent = identity.available
      ? `${identity.context.productVersion} / ${identity.context.runtimeVersion} (${identity.runtimeVersionSource})`
      : "身份不可用";
    verificationElements.count.textContent = `${summary["current-passed"]}/${acceptanceStatus.entries.length}`;
    verificationElements.environment.textContent = identity.available ? identity.context.environment : (identity.environment || "尚未验证");
    verificationElements.implementation.textContent = identity.available ? identity.context.implementationFingerprint : identity.reason;
    verificationElements.contract.textContent = contract.contractFingerprint;
    verificationElements.sources.textContent = acceptanceStatus.entries.map((entry) => entry.evidenceSource).filter((value, index, values) => values.indexOf(value) === index).join(", ");
    renderVerificationList();
    verificationElements.root.dataset.state = "ready";
  } catch (error) {
    verificationElements.list.replaceChildren();
    const message = document.createElement("p");
    message.className = "verification-empty error-copy";
    message.textContent = error instanceof Error ? error.message : String(error);
    verificationElements.list.append(message);
    verificationElements.runtime.textContent = "无法读取";
    verificationElements.root.dataset.state = "error";
  }
}

function showEvidence(runId) {
  const entry = acceptanceStatus?.entries
    .map((candidate) => candidate.result.latestRecord)
    .find((candidate) => candidate?.verificationRunId === runId);
  if (!entry) return;
  verificationElements.evidence.textContent = JSON.stringify(entry, null, 2);
  const details = document.querySelector("[data-evidence-details]");
  details?.setAttribute("open", "");
  details?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function exportVerification() {
  const payload = await portableRuntimeAcceptance().export({ locale: "zh-CN" });
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${payload.appId}.portable-runtime-acceptance.json`;
  link.click();
  URL.revokeObjectURL(url);
}


const scenarios = {
  shared: document.querySelector('[data-scenario="shared"]'),
  data: document.querySelector('[data-scenario="data"]'),
  resident: document.querySelector('[data-scenario="resident"]'),
  composition: document.querySelector('[data-scenario="composition"]'),
  network: document.querySelector('[data-scenario="network"]'),
  failure: document.querySelector('[data-scenario="failure"]'),
};

const residentElements = {
  epoch: document.querySelector('[data-resident="epoch"]'),
  memoryCount: document.querySelector('[data-resident="memory-count"]'),
  eventCount: document.querySelector('[data-resident="event-count"]'),
  lastEvent: document.querySelector('[data-resident="last-event"]'),
  events: document.querySelector("[data-resident-events]"),
};

const compositionElements = {
  name: document.querySelector('[data-field="contact-name"]'),
  email: document.querySelector('[data-field="contact-email"]'),
  tags: document.querySelector('[data-field="contact-tags"]'),
};

const dataElements = {
  id: document.querySelector('[data-field="record-id"]'),
  title: document.querySelector('[data-field="record-title"]'),
  status: document.querySelector('[data-field="record-status"]'),
  records: document.querySelector("[data-records]"),
};

function bridge() {
  const serviceActions = window.nextclaw?.serviceActions;
  if (!serviceActions) throw new Error("NextClaw Panel bridge 尚未就绪，请刷新后重试。");
  return serviceActions;
}

async function invoke(actionId, input = {}) {
  return await bridge().invoke(actionId, input);
}

function setState(scenario, state, value) {
  const container = scenarios[scenario];
  const result = container.querySelector(".result");
  container.dataset.state = state;
  result.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  for (const button of container.querySelectorAll("button")) {
    button.disabled = state === "pending";
  }
}

function errorValue(error) {
  return {
    code: error?.code ?? "ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
}

async function run(scenario, operation) {
  setState(scenario, "pending", "正在通过宿主执行…");
  try {
    const result = await operation();
    setState(scenario, "success", result);
  } catch (error) {
    setState(scenario, "error", errorValue(error));
  }
}

function renderRecords(data) {
  const records = Array.isArray(data?.records) ? data.records : [];
  dataElements.records.replaceChildren();
  if (records.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "当前没有记录";
    row.append(cell);
    dataElements.records.append(row);
    return;
  }
  for (const record of records) {
    const row = document.createElement("tr");
    for (const value of [
      record.id,
      record.title,
      record.status,
      Array.isArray(record.tags) ? record.tags.join(", ") : "",
      record.version,
    ]) {
      const cell = document.createElement("td");
      cell.textContent = String(value ?? "");
      row.append(cell);
    }
    dataElements.records.append(row);
  }
}

async function refreshData() {
  const data = await invoke(actions.recordsList);
  renderRecords(data);
  return {
    revision: data.revision,
    recordCount: data.recordCount,
    contentHash: data.contentHash,
    persistedBy: data.persistedBy,
  };
}

function recordInput() {
  return {
    id: dataElements.id.value.trim(),
    title: dataElements.title.value.trim(),
    status: dataElements.status.value,
    tags: ["panel", "verification"],
  };
}

function renderResident(data) {
  residentElements.epoch.textContent = String(data?.instanceEpoch ?? "—");
  residentElements.memoryCount.textContent = String(data?.inMemoryEventCount ?? "—");
  residentElements.eventCount.textContent = String(data?.eventCount ?? "—");
  residentElements.lastEvent.textContent = data?.lastEventKind
    ? `${data.lastEventKind} · ${data.lastEventId}`
    : "—";
  const events = Array.isArray(data?.recentEvents) ? [...data.recentEvents].reverse() : [];
  residentElements.events.replaceChildren();
  if (events.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "当前没有事件";
    row.append(cell);
    residentElements.events.append(row);
    return;
  }
  for (const event of events) {
    const row = document.createElement("tr");
    for (const value of [event.eventId, event.kind, event.triggeredAt]) {
      const cell = document.createElement("td");
      cell.textContent = String(value ?? "");
      row.append(cell);
    }
    residentElements.events.append(row);
  }
}

async function refreshResident() {
  const data = await invoke(actions.residentStatus);
  renderResident(data);
  return {
    started: data.started,
    instanceEpoch: data.instanceEpoch,
    inMemoryEventCount: data.inMemoryEventCount,
    eventCount: data.eventCount,
    lastEventId: data.lastEventId,
    persistedBy: data.persistedBy,
  };
}

const operations = {
  shared: () => run("shared", async () => {
    const state = await invoke(actions.stateRuntime);
    const capability = await invoke(actions.capabilityRuntime);
    return {
      sameRunner: state.runnerPid === capability.runnerPid,
      stateComponent: state,
      capabilityComponent: capability,
    };
  }),
  "data-refresh": () => run("data", refreshData),
  "data-seed": () => run("data", async () => {
    await invoke(actions.recordsSeed);
    return await refreshData();
  }),
  "data-save": () => run("data", async () => {
    await invoke(actions.recordUpsert, recordInput());
    return await refreshData();
  }),
  "data-delete": () => run("data", async () => {
    await invoke(actions.recordDelete, { id: dataElements.id.value.trim() });
    return await refreshData();
  }),
  "resident-refresh": () => run("resident", refreshResident),
  "resident-event": () => run("resident", async () => {
    await invoke(actions.residentEmitEvent, {
      eventId: `panel-${Date.now()}`,
      kind: "panel-manual",
      triggeredAt: new Date().toISOString(),
    });
    return await refreshResident();
  }),
  "resident-reset": () => run("resident", async () => {
    await invoke(actions.residentReset);
    return await refreshResident();
  }),
  "composition-run": () => run("composition", () => invoke(actions.composeContact, {
    name: compositionElements.name.value,
    email: compositionElements.email.value,
    tags: compositionElements.tags.value.split(",").map((tag) => tag.trim()),
  })),
  "provider-status": () => run("composition", () => invoke(actions.providerStatus)),
  "provider-denied": () => run("composition", () => invoke(actions.providerDenied)),
  "network-allowed": () => run("network", () => invoke(actions.networkAllowed)),
  "network-denied": () => run("network", () => invoke(actions.networkDenied)),
  "structured-failure": () => run("failure", async () => {
    try {
      await invoke(actions.structuredFailure);
      return { failedAsExpected: false };
    } catch (error) {
      return { failedAsExpected: true, error: errorValue(error) };
    }
  }),
  "timeout-recovery": () => run("failure", async () => {
    let timeout;
    try {
      await invoke(actions.timeout);
      timeout = { timedOutAsExpected: false };
    } catch (error) {
      timeout = { timedOutAsExpected: error?.code === "SERVICE_APP_RUNTIME_FAILED", error: errorValue(error) };
    }
    const persistedState = await invoke(actions.dataSnapshot);
    const recoveredRuntime = await invoke(actions.stateRuntime);
    return { timeout, recovered: true, persistedState, recoveredRuntime };
  }),
};

for (const button of document.querySelectorAll("[data-run]")) {
  button.addEventListener("click", () => operations[button.dataset.run]?.());
}

document.querySelector("[data-refresh-verification]")?.addEventListener("click", () => {
  void refreshVerification();
});
document.querySelector("[data-export-verification]")?.addEventListener("click", () => {
  void exportVerification().catch((error) => {
    verificationElements.root.dataset.state = "error";
    verificationElements.evidence.textContent = JSON.stringify(errorValue(error), null, 2);
  });
});
verificationElements.list.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const viewButton = target.closest("[data-view-evidence]");
  if (viewButton instanceof HTMLElement) showEvidence(viewButton.dataset.viewEvidence);
});
void refreshVerification();

void refreshResident().then((result) => {
  setState("resident", "success", result);
}).catch((error) => {
  setState("resident", "error", errorValue(error));
});

const residentPoll = setInterval(() => {
  if (document.visibilityState !== "visible") return;
  void refreshResident().then((result) => {
    setState("resident", "success", result);
  }).catch((error) => {
    setState("resident", "error", errorValue(error));
  });
}, 2000);
window.addEventListener("pagehide", () => clearInterval(residentPoll), { once: true });
