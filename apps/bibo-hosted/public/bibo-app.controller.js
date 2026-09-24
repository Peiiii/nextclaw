const $ = (id) => document.getElementById(id);
const state = { user: null, busy: false, mode: "register" };

async function api(path, body) {
  const response = await fetch(`/app/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    credentials: "same-origin",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let value;
  try { value = await response.json(); } catch { value = {}; }
  if (!response.ok) throw new Error(value.error || `请求失败 (${response.status})`);
  return value;
}

function setStatus(message) { $("status-message").textContent = message; }
function setAuthError(message) { $("auth-error").textContent = message; }
function setBusy(busy) {
  state.busy = busy;
  $("send-button").disabled = busy;
  $("message-input").disabled = busy;
  $("send-button").textContent = busy ? "…" : "↑";
}

function renderMessages(messages) {
  const list = $("messages");
  list.replaceChildren();
  const hasMessages = messages?.length > 0;
  $("welcome").hidden = hasMessages;
  list.hidden = !hasMessages;
  if (!hasMessages) return;
  for (const message of messages) {
    const item = document.createElement("article");
    item.className = `message ${message.role}`;
    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = message.role === "assistant" ? "Bibo" : "你";
    const content = document.createElement("div");
    content.className = "message-body";
    content.textContent = message.text;
    item.append(meta, content);
    list.append(item);
  }
  list.scrollTop = list.scrollHeight;
}

function updateAccount() {
  $("auth-overlay").hidden = Boolean(state.user);
  $("account-label").textContent = state.user?.email ?? "等待你来认识";
  $("logout-button").hidden = !state.user;
  $("reset-button").hidden = !state.user;
}

async function refreshAccount() {
  try {
    const result = await api("auth/me");
    state.user = result.user;
    updateAccount();
  } catch {
    state.user = null;
    updateAccount();
    return;
  }
  try {
    const history = await api("history");
    renderMessages(history.messages);
  } catch (error) {
    setStatus(`对话记录暂时无法加载：${error.message}`);
  }
}

function setMode(mode) {
  state.mode = mode;
  for (const tab of document.querySelectorAll("[data-mode]")) tab.classList.toggle("selected", tab.dataset.mode === mode);
  $("code-field").hidden = mode === "login";
  $("auth-code").required = mode === "register";
  $("auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("auth-submit").firstChild.textContent = mode === "login" ? "登录 " : "创建账号 ";
  setAuthError("");
}

document.querySelectorAll("[data-mode]").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => {
  $("message-input").value = button.dataset.prompt;
  $("message-input").focus();
}));

$("send-code").addEventListener("click", async () => {
  const email = $("auth-email").value.trim();
  if (!email || !$("auth-email").checkValidity()) return setAuthError("请先填写有效邮箱。 ");
  const button = $("send-code");
  button.disabled = true;
  setAuthError("");
  try {
    const result = await api("auth/send-code", { email });
    setAuthError(`验证码已发往 ${result.maskedEmail ?? email}。请检查邮箱。`);
  } catch (error) {
    setAuthError(error.message);
  } finally { button.disabled = false; }
});

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const button = $("auth-submit");
  button.disabled = true;
  setAuthError("");
  try {
    const result = state.mode === "login"
      ? await api("auth/login", { email, password })
      : await api("auth/register", { email, code: $("auth-code").value.trim(), password });
    state.user = result.user;
    updateAccount();
    await refreshAccount();
    $("message-input").focus();
  } catch (error) { setAuthError(error.message); }
  finally { button.disabled = false; }
});

$("logout-button").addEventListener("click", async () => {
  try { await api("auth/logout", {}); } catch { /* The local session is cleared below. */ }
  state.user = null;
  renderMessages([]);
  updateAccount();
});

$("menu-button").addEventListener("click", () => {
  const open = document.querySelector(".sidebar").classList.toggle("open");
  $("menu-button").setAttribute("aria-expanded", String(open));
});

$("home-link").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.remove("open");
  $("menu-button").setAttribute("aria-expanded", "false");
});

$("reset-button").addEventListener("click", async () => {
  if (!confirm("确认清空 Bibo 的对话和个人空间？这项操作无法撤销。")) return;
  try {
    await api("reset", {});
    renderMessages([]);
    setStatus("个人空间已清空。你可以重新开始。 ");
  } catch (error) { setStatus(error.message); }
});

$("chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;
  if (!state.user) return updateAccount();
  const input = $("message-input");
  const message = input.value.trim();
  if (!message) return;
  setStatus("Bibo 正在认真处理……");
  setBusy(true);
  try {
    const result = await api("chat", { message });
    input.value = "";
    renderMessages(result.messages);
    setStatus("");
  } catch (error) {
    setStatus(error.message);
    if (error.message.includes("登录")) await refreshAccount();
  } finally { setBusy(false); }
});

$("message-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $("chat-form").requestSubmit();
  }
});

setMode("register");
await refreshAccount();
