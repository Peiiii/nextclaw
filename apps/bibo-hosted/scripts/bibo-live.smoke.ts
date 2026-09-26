import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const origin = "https://app.bibo.bot";
const accountFile = process.env.BIBO_SMOKE_ACCOUNT_FILE ?? join(homedir(), ".config", "bibo-hosted", "smoke-account.json");
type SmokeAccount = { origin: string; email: string; password: string; userId: string };

function loadAccount(): SmokeAccount {
  if (statSync(accountFile).mode & 0o077) throw new Error(`Restrict ${accountFile} to the owner with chmod 600.`);
  const account = JSON.parse(readFileSync(accountFile, "utf8")) as Partial<SmokeAccount>;
  assert.equal(account.origin, origin, "Smoke account origin must match the production Bibo origin");
  for (const field of ["email", "password", "userId"] as const) {
    assert.ok(typeof account[field] === "string" && account[field].length > 0, `Smoke account is missing ${field}`);
  }
  return account as SmokeAccount;
}

const smokeAccount = loadAccount();
const login = await fetch(`${origin}/api/auth/login`, {
  method: "POST",
  headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ email: smokeAccount.email, password: smokeAccount.password }),
  signal: AbortSignal.timeout(15_000),
});
assert.equal(login.status, 200, `Smoke account login returned ${login.status}`);
const token = login.headers.get("set-cookie")?.match(/(?:^|;\s*)bibo_session=([^;]+)/)?.[1];
assert.ok(token, "Smoke account login did not set a Bibo session cookie");
const sessionToken = decodeURIComponent(token);

const cookie = `bibo_session=${encodeURIComponent(sessionToken)}`;
const headers = { cookie };
const requestId = `bibo-live-${crypto.randomUUID().slice(0, 8)}`;
const artifactPath = `${requestId}.md`;
const artifactContent = `# ${requestId}\n\n真实 Agent 文件验收。`;
const prompt = `请通过 Bibo 第一方能力创建产物文件 ${artifactPath}，内容严格为：\n${artifactContent}\n先按需查询文件领域用法，再实际执行。不要用 shell 或直接修改 JSON。成功后用一句话回复“${requestId} 已收到”，不要创建其他对象。`;
const abort = new AbortController();
const timeout = setTimeout(() => abort.abort(), 300_000);
let createdSessionId: string | undefined;
type LiveFile = { id: string; path: string; version: number; content?: string };

async function space<T>(action: string, input: Record<string, unknown>, signal = abort.signal): Promise<T> {
  const response = await fetch(`${origin}/api/space`, {
    method: "POST", headers: { ...headers, origin, "content-type": "application/json" },
    body: JSON.stringify({ action, input }), signal,
  });
  assert.equal(response.status, 200, `${action} returned ${response.status}`);
  return (await response.json() as { result: T }).result;
}

type StreamState = { accepted: boolean; saving: boolean; committed: boolean; deltaCount: number; firstDeltaMs: number; lastDeltaMs: number; savingMs: number };

async function readSseFrames(response: Response, onFrame: (frame: string) => void): Promise<void> {
  assert.ok(response.body, "SSE response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    let boundary: number;
    while ((boundary = pending.indexOf("\n\n")) >= 0) {
      onFrame(pending.slice(0, boundary));
      pending = pending.slice(boundary + 2);
    }
    if (done) break;
  }
}

function recordFrame(frame: string, state: StreamState, started: number): StreamState {
  const name = frame.match(/^event: (.+)$/m)?.[1];
  const data = frame.match(/^data: (.+)$/m)?.[1];
  if (!name || !data) return state;
  const payload = JSON.parse(data) as { error?: string };
  if (name === "error") throw new Error(payload.error ?? "Chat stream failed");
  const elapsed = Math.round(performance.now() - started);
  if (name === "accepted") return { ...state, accepted: true };
  if (name === "delta") return { ...state, deltaCount: state.deltaCount + 1, firstDeltaMs: state.firstDeltaMs || elapsed, lastDeltaMs: elapsed };
  if (name === "saving") return { ...state, saving: true, savingMs: elapsed };
  if (name === "committed") return { ...state, committed: true };
  return state;
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(`${origin}${path}`, { headers, signal: abort.signal });
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return await response.json() as T;
}

async function modelStreamProbe(): Promise<{ contentChunks: number; firstContentMs: number }> {
  const started = performance.now();
  const response = await fetch(`${origin}/api/model/v1/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${sessionToken}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "deepseek-flash", messages: [{ role: "user", content: "请用两句话介绍 Bibo。" }], stream: true, max_tokens: 128 }),
    signal: abort.signal,
  });
  assert.equal(response.status, 200, `Model proxy returned ${response.status}`);
  assert.ok(response.headers.get("content-type")?.includes("text/event-stream"), "Model proxy must stream SSE");
  let reasoningChunks = 0;
  let contentChunks = 0;
  let firstContentMs = 0;
  await readSseFrames(response, (frame) => {
    const data = frame.match(/^data: (.+)$/m)?.[1];
    if (!data || data === "[DONE]") return;
    const delta = (JSON.parse(data) as { choices?: Array<{ delta?: { content?: string | null; reasoning_content?: string | null } }> }).choices?.[0]?.delta;
    if (delta?.reasoning_content) reasoningChunks += 1;
    if (delta?.content) { contentChunks += 1; firstContentMs ||= Math.round(performance.now() - started); }
  });
  assert.equal(reasoningChunks, 0, "Bibo default model mode generated hidden reasoning before the answer");
  assert.ok(contentChunks > 1, "Model proxy did not stream multiple visible answer chunks");
  return { contentChunks, firstContentMs };
}

async function streamedRun(sessionId: string): Promise<{ deltaCount: number; firstDeltaMs: number; lastDeltaMs: number; savingMs: number; totalMs: number }> {
  const started = performance.now();
  const response = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { ...headers, origin, accept: "text/event-stream", "content-type": "application/json" },
    body: JSON.stringify({ message: prompt, sessionId }),
    signal: abort.signal,
  });
  assert.equal(response.status, 200, `Chat returned ${response.status}`);
  assert.ok(response.headers.get("content-type")?.includes("text/event-stream"), "Chat must stream SSE");
  let state: StreamState = { accepted: false, saving: false, committed: false, deltaCount: 0, firstDeltaMs: 0, lastDeltaMs: 0, savingMs: 0 };
  await readSseFrames(response, (frame) => { state = recordFrame(frame, state, started); });
  assert.ok(state.accepted, "Run was not accepted");
  assert.ok(state.deltaCount > 0, "No live output was streamed");
  assert.ok(state.saving, "Snapshot save was not announced");
  assert.ok(state.committed, "Run did not commit to storage");
  assert.ok(state.firstDeltaMs < state.savingMs, "First answer chunk arrived only after saving started");
  return { deltaCount: state.deltaCount, firstDeltaMs: state.firstDeltaMs, lastDeltaMs: state.lastDeltaMs, savingMs: state.savingMs, totalMs: Math.round(performance.now() - started) };
}

try {
  const account = await json<{ user?: { id: string } }>("/api/auth/me");
  assert.equal(account.user?.id, smokeAccount.userId, "Smoke account identity does not match the local credential file");
  const missingHistory = await fetch(`${origin}/api/history?id=${requestId}-missing`, { headers, signal: abort.signal });
  assert.equal(missingHistory.status, 404, "An explicit missing session must not appear as a new empty conversation");
  assert.equal((await missingHistory.json() as { error: string }).error, "会话不存在或已删除。");
  const modelStream = await modelStreamProbe();
  const creation = await fetch(`${origin}/api/sessions`, {
    method: "POST", headers: { ...headers, origin }, signal: abort.signal,
  });
  assert.equal(creation.status, 200, "Smoke conversation creation failed");
  const created = await creation.json() as { session: { id: string } };
  assert.ok(created.session?.id, "Created conversation has no ID");
  createdSessionId = created.session.id;
  const historyPath = `/api/history?id=${encodeURIComponent(createdSessionId)}`;
  const before = await json<{ messages: Array<{ role: string; text: string }> }>(historyPath);
  assert.equal(before.messages.length, 0, "New conversation must be isolated from existing history");
  const stream = await streamedRun(createdSessionId);
  const after = await json<{ messages: Array<{ role: string; text: string }> }>(historyPath);
  assert.equal(after.messages.length, before.messages.length + 2, "Saved history must contain one new exchange");
  assert.equal(after.messages.at(-2)?.text, prompt, "Saved user message differs");
  assert.ok(after.messages.at(-1)?.text.includes(requestId), "Saved answer is missing the request marker");
  const files = await space<{ items: LiveFile[] }>("file.list", { query: artifactPath });
  const artifact = files.items.find((file) => file.path === artifactPath);
  assert.ok(artifact, "Agent claimed success without creating the requested file");
  const persisted = await space<LiveFile>("file.get", { id: artifact.id });
  assert.equal(persisted.content, artifactContent, "Agent file content was not persisted exactly");
  // The Tasks screen loads these together; cloud serialization must not reject either read.
  await Promise.all([space("project.list", { limit: 100 }), space("task.list", { limit: 100 })]);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      await context.addCookies([{ name: "bibo_session", value: sessionToken, domain: "app.bibo.bot", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/chat/${encodeURIComponent(createdSessionId)}`, { waitUntil: "networkidle" });
      await page.locator(".ui-message").first().waitFor();
      await page.reload({ waitUntil: "networkidle" });
      await page.locator(".ui-message--assistant").filter({ hasText: requestId }).waitFor();
      const layout = await page.evaluate(() => ({
        body: document.body.scrollHeight,
        viewport: innerHeight,
        composerBottom: document.querySelector(".ui-composer")!.getBoundingClientRect().bottom,
        listHeight: document.querySelector(".bibo-messages")!.clientHeight,
        contentHeight: document.querySelector(".bibo-messages")!.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(layout.body, layout.viewport, "The page must not scroll behind the chat");
      assert.ok(layout.composerBottom <= layout.viewport, "Composer must remain visible");
      if (after.messages.length >= 8) assert.ok(layout.contentHeight > layout.listHeight, "Long history must scroll inside the message list");
      assert.equal(layout.horizontalOverflow, false, "Page has horizontal overflow");
      assert.deepEqual(errors, [], "Browser raised a runtime error");
      assert.ok(await page.locator(".ui-message--assistant").filter({ hasText: requestId }).count(), "Saved answer did not load after refresh");
      await page.goto(`${origin}/files`, { waitUntil: "networkidle" });
      await page.getByRole("textbox", { name: "搜索文件", exact: true }).fill(artifactPath);
      await page.getByText(artifactPath, { exact: true }).first().click();
      assert.equal(await page.getByRole("textbox", { name: `编辑 ${artifactPath}` }).inputValue(), artifactContent,
        "The Files UI must read the same Agent-created object");
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ ok: true, requestId, modelStream, ...stream, saved: true, agentFile: true, desktop: true, mobile: true }));
} finally {
  clearTimeout(timeout);
  if (createdSessionId) {
    const files = await space<{ items: LiveFile[] }>("file.list", { query: artifactPath }, AbortSignal.timeout(60_000));
    for (const file of files.items.filter((item) => item.path === artifactPath)) {
      await space("file.delete", { id: file.id, version: file.version }, AbortSignal.timeout(60_000));
    }
    const cleanup = await fetch(`${origin}/api/sessions/delete`, {
      method: "POST", headers: { ...headers, origin, "content-type": "application/json" },
      body: JSON.stringify({ id: createdSessionId }), signal: AbortSignal.timeout(60_000),
    });
    assert.equal(cleanup.status, 200, `Smoke conversation cleanup failed: ${cleanup.status}`);
  }
}
