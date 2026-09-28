import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const origin = "https://app.bibo.bot";
const displayOnly = process.env.BIBO_SMOKE_SCOPE === "display";
const questionOnly = process.env.BIBO_SMOKE_SCOPE === "question";
const questionMobile = questionOnly && process.env.BIBO_SMOKE_VIEWPORT === "mobile";
const skipQuestion = questionOnly && process.env.BIBO_SMOKE_ACTION === "skip";
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
  const prompt = `请调用 bibo 工具执行 file.create，input 严格使用这个 JSON：${JSON.stringify({ path: artifactPath, kind: "artifact", content: artifactContent })}。content 必须与 JSON 字符串逐字一致，不添加末尾换行。创建后调用 show_file，path 使用返回的文件路径，viewer=rendered，在右侧预览该文件。不要用 shell 或直接修改 JSON。成功后用一句话回复“${requestId} 已收到”，不要创建其他对象。`;
const questionPrompt = "请立即调用 request_user_input_async 工具问我‘报告装订方式？’，选项为‘订书钉’和‘胶装’，推荐‘胶装’，并给‘胶装’加上‘适合正式交付’的简短解释。工具保存问题后用一句话说明你会等待我的选择；不要替我选择。";
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

async function cleanupSmokeSession(sessionId: string): Promise<void> {
  if (!questionOnly) {
    const files = await space<{ items: LiveFile[] }>("file.list", { query: artifactPath }, AbortSignal.timeout(60_000));
    for (const file of files.items.filter((item) => item.path === artifactPath)) {
      await space("file.delete", { id: file.id, version: file.version }, AbortSignal.timeout(60_000));
    }
  }
  const cleanup = await fetch(`${origin}/api/sessions/delete`, {
    method: "POST", headers: { ...headers, origin, "content-type": "application/json" },
    body: JSON.stringify({ id: sessionId }), signal: AbortSignal.timeout(60_000),
  });
  assert.equal(cleanup.status, 200, `Smoke conversation cleanup failed: ${cleanup.status}`);
}

type StreamState = { accepted: boolean; saving: boolean; committed: boolean; deltaCount: number; displayCount: number };

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

function recordFrame(frame: string, state: StreamState): StreamState {
  const name = frame.match(/^event: (.+)$/m)?.[1];
  const data = frame.match(/^data: (.+)$/m)?.[1];
  if (!name || !data) return state;
  const payload = JSON.parse(data) as { error?: string; sessionId?: string; target?: { type?: string; payload?: { path?: string } } };
  if (name === "error") throw new Error(payload.error ?? "Chat stream failed");
  if (name === "accepted") return { ...state, accepted: true };
  if (name === "delta") {
    assert.equal(state.saving, false, "Visible output must arrive before saving");
    return { ...state, deltaCount: state.deltaCount + 1 };
  }
  if (name === "saving") return { ...state, saving: true };
  if (name === "show-content") {
    assert.ok(state.saving && !state.committed, "Display must follow saving and precede the terminal commit");
    assert.equal(payload.sessionId, createdSessionId);
    assert.equal(payload.target?.type, "file");
    assert.ok(payload.target?.payload?.path?.endsWith(artifactPath), "Display must reference the requested artifact");
    return { ...state, displayCount: state.displayCount + 1 };
  }
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

async function searchProbe(): Promise<{ requestId: string; resultCount: number }> {
  const endpoint = `${origin}/api/search/exa`;
  const body = JSON.stringify({ query: "Cloudflare AI Search official documentation" });
  const unauthorized = await fetch(endpoint, { method: "POST", body, signal: abort.signal });
  assert.equal(unauthorized.status, 401, "Search must require a verified account token");
  const response = await fetch(endpoint, {
    method: "POST", headers: { authorization: `Bearer ${sessionToken}`, "content-type": "application/json" }, body, signal: abort.signal,
  });
  assert.equal(response.status, 200, `Search proxy returned ${response.status}`);
  const result = await response.json() as { requestId: string; results: Array<{ url: string; highlights?: string[] }> };
  assert.ok(result.requestId, "Exa did not return a request ID");
  assert.ok(result.results.some((item) => item.url.startsWith("https://developers.cloudflare.com/") && item.highlights?.length), "Search must return official sources with actual page excerpts");
  return { requestId: result.requestId, resultCount: result.results.length };
}

async function streamedRun(page: Page, message = prompt): Promise<{ deltaCount: number; displayCount: number; totalMs: number }> {
  const started = performance.now();
  await page.evaluate(() => { Reflect.set(window, "biboSmokeStream", null); });
  const result = page.waitForResponse((response) => response.url() === `${origin}/api/chat`, { timeout: 300_000 });
  await page.getByRole("textbox", { name: /告诉 Bibo/ }).fill(message);
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  const response = await result;
  if (response.status() !== 200) {
    const failure = await response.json() as { error?: string };
    assert.fail(`Chat returned ${response.status()}: ${failure.error ?? "No public error"}`);
  }
  assert.ok(response.headers()["content-type"]?.includes("text/event-stream"), "Chat must stream SSE");
  await page.waitForFunction(() => Reflect.get(window, "biboSmokeStream") !== null, null, { timeout: 300_000 });
  const captured = await page.evaluate(() => Reflect.get(window, "biboSmokeStream") as { text?: string; error?: string });
  assert.ok(captured.text, captured.error ?? "Browser did not capture the chat stream");
  let state: StreamState = { accepted: false, saving: false, committed: false, deltaCount: 0, displayCount: 0 };
  try {
    for (const frame of captured.text.split("\n\n")) state = recordFrame(frame, state);
  } catch (error) {
    throw new Error(`Chat failed after ${Math.round(performance.now() - started)}ms (${state.deltaCount} deltas): ${String(error)}`);
  }
  assert.ok(state.accepted, "Run was not accepted");
  assert.ok(state.deltaCount > 0, "No live output was streamed");
  assert.ok(state.saving, "Snapshot save was not announced");
  assert.ok(state.committed, "Run did not commit to storage");
  if (message === prompt) assert.ok(state.displayCount > 0, "Agent did not request file display");
  return { deltaCount: state.deltaCount, displayCount: state.displayCount, totalMs: Math.round(performance.now() - started) };
}

const browser = await chromium.launch({ headless: true });
let smokeError: unknown;
let smokeResult: Record<string, unknown> | undefined;
try {
  const account = await json<{ user?: { id: string } }>("/api/auth/me");
  assert.equal(account.user?.id, smokeAccount.userId, "Smoke account identity does not match the local credential file");
  const missingHistory = await fetch(`${origin}/api/history?id=${requestId}-missing`, { headers, signal: abort.signal });
  assert.equal(missingHistory.status, 404, "An explicit missing session must not appear as a new empty conversation");
  assert.equal((await missingHistory.json() as { error: string }).error, "会话不存在或已删除。");
  const modelStream = displayOnly || questionOnly ? undefined : await modelStreamProbe();
  const search = displayOnly || questionOnly ? undefined : await searchProbe();
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
  const context = await browser.newContext({ viewport: questionMobile ? { width: 390, height: 844 } : { width: 1365, height: 900 } });
  await context.addCookies([{ name: "bibo_session", value: sessionToken, domain: "app.bibo.bot", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  await context.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (new URL(response.url).pathname === "/api/chat") {
        void response.clone().text().then(
          (text) => Reflect.set(window, "biboSmokeStream", { text }),
          (error: unknown) => Reflect.set(window, "biboSmokeStream", { error: String(error) }),
        );
      }
      return response;
    };
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/chat/${encodeURIComponent(createdSessionId)}`, { waitUntil: "networkidle" });
  let searchStream: Awaited<ReturnType<typeof streamedRun>> | undefined;
  let stream: Awaited<ReturnType<typeof streamedRun>> | undefined;
  if (!questionOnly) {
    const searchPrompt = "请先调用 web_search 搜索 Cloudflare AI Search 最新官方文档，用两句话说明它的用途并附至少一个官方来源链接。不要只凭记忆回答。";
    searchStream = displayOnly ? undefined : await streamedRun(page, searchPrompt);
    const searched = await json<{ messages: Array<{ role: string; text: string }> }>(historyPath);
    if (!displayOnly) {
      assert.equal(searched.messages.length, 2, "Search exchange must save");
      assert.equal(searched.messages.at(-2)?.text, searchPrompt);
      assert.match(searched.messages.at(-1)?.text ?? "", /https:\/\/developers\.cloudflare\.com\//, "Search-backed answer must save its source link");
    }
    stream = await streamedRun(page);
    const workspace = page.getByRole("complementary", { name: "右侧工作区" });
    await workspace.getByRole("heading", { name: requestId, exact: true }).waitFor();
    const after = await json<{ messages: Array<{ role: string; text: string }> }>(historyPath);
    assert.equal(after.messages.length, searched.messages.length + 2, "Saved history must contain one new exchange");
    assert.equal(after.messages.at(-2)?.text, prompt, "Saved user message differs");
    assert.ok(after.messages.at(-1)?.text.includes(requestId), "Saved answer is missing the request marker");
    const files = await space<{ items: LiveFile[] }>("file.list", { query: artifactPath });
    const artifact = files.items.find((file) => file.path === artifactPath);
    assert.ok(artifact, "Agent claimed success without creating the requested file");
    const persisted = await space<LiveFile>("file.get", { id: artifact.id });
    assert.equal(persisted.content, artifactContent, "Agent file content was not persisted exactly");
    // The Tasks screen loads these together; cloud serialization must not reject either read.
    await Promise.all([space("project.list", { limit: 100 }), space("task.list", { limit: 100 })]);

    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${origin}/chat/${encodeURIComponent(createdSessionId)}`, { waitUntil: "networkidle" });
      if (!await workspace.count()) await page.getByRole("button", { name: "打开右侧工作区" }).click();
      await page.locator(".ui-message").first().waitFor();
      await page.reload({ waitUntil: "networkidle" });
      await page.locator(".ui-message--assistant").filter({ hasText: requestId }).waitFor();
      await workspace.getByRole("heading", { name: requestId, exact: true }).waitFor();
      await page.screenshot({ path: `/tmp/bibo-live-display-${viewport.width}.png`, fullPage: true });
      await page.getByRole("button", { name: "关闭工作区" }).click();
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
      if (!displayOnly) assert.ok(await page.locator('.ui-message--assistant a[href^="https://developers.cloudflare.com/"]').count(),
        "Saved search sources must remain clickable after refresh");
      await page.goto(`${origin}/files`, { waitUntil: "networkidle" });
      if (!await page.getByRole("textbox", { name: "搜索文件", exact: true }).isVisible()) {
        await page.getByRole("button", { name: "← 目录", exact: true }).click();
      }
      await page.getByRole("textbox", { name: "搜索文件", exact: true }).fill(artifactPath);
      await page.getByRole("region", { name: "文件搜索结果", exact: true }).getByText(artifactPath, { exact: true }).first().click();
      await page.getByRole("heading", { name: requestId, exact: true }).waitFor();
      await page.getByText("真实 Agent 文件验收。", { exact: true }).waitFor();
    }
  }
  await page.goto(`${origin}/chat/${encodeURIComponent(createdSessionId)}`, { waitUntil: "networkidle" });
  await streamedRun(page, questionPrompt);
  const questioned = await json<{ messages: Array<{ role: string; text: string; questions?: Array<{ id: string; title: string; status: string; recommendedOption?: string; optionDescriptions?: Record<string, string> }>; replyToQuestion?: { id: string; title: string; action: string } }> }>(historyPath);
  const asked = questioned.messages.at(-1)?.questions?.find((item) => item.title === "报告装订方式？");
  assert.ok(asked, "The model did not use the async user question tool");
  assert.equal(asked.status, "pending");
  assert.equal(asked.recommendedOption, "胶装");
  assert.equal(asked.optionDescriptions?.["胶装"], "适合正式交付");
  const panel = page.getByRole("region", { name: "问题" });
  await panel.getByRole("heading", { name: "报告装订方式？" }).waitFor();
  await panel.getByRole("button", { name: "关闭问题" }).click();
  await page.getByRole("button", { name: "回答问题：报告装订方式？" }).click();
  await page.evaluate(() => { Reflect.set(window, "biboSmokeStream", null); });
  const replyResponse = page.waitForResponse((response) => response.url() === `${origin}/api/chat`, { timeout: 300_000 });
  if (skipQuestion) await panel.getByRole("button", { name: "跳过" }).click();
  else await panel.getByRole("button", { name: /胶装/ }).first().click();
  assert.equal((await replyResponse).status(), 200, "Question reply request was rejected");
  await page.waitForFunction(() => Reflect.get(window, "biboSmokeStream") !== null, null, { timeout: 300_000 });
  const replyStream = await page.evaluate(() => Reflect.get(window, "biboSmokeStream") as { text?: string; error?: string });
  assert.ok(replyStream.text?.includes("event: committed"), replyStream.error ?? "Question reply did not commit");
  await page.locator(".bibo-question-reference").filter({ hasText: "报告装订方式？" }).waitFor({ timeout: 300_000 });
  const answered = await json<typeof questioned>(historyPath);
  assert.equal(answered.messages.at(-2)?.replyToQuestion?.id, asked.id, "Answer must retain its question reference");
  assert.equal(answered.messages.at(-2)?.text, skipQuestion ? "跳过" : "胶装");
  assert.equal(answered.messages.at(-2)?.replyToQuestion?.action, skipQuestion ? "dismissed" : "answered");
  assert.equal(answered.messages.find((item) => item.questions?.some((question) => question.id === asked.id))?.questions?.find((question) => question.id === asked.id)?.status, skipQuestion ? "dismissed" : "answered");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".bibo-question-reference").filter({ hasText: "报告装订方式？" }).waitFor();
  smokeResult = { ok: true, requestId, modelStream, search, searchStream, ...stream, asyncQuestion: true,
    ...(questionMobile ? { mobileQuestion: true } : {}), ...(skipQuestion ? { skippedQuestion: true } : {}),
    ...(!questionOnly ? { saved: true, agentFile: true, automaticPreview: true, desktop: true, mobile: true } : {}) };
} catch (error) {
  smokeError = error;
  for (const context of browser.contexts()) {
    const page = context.pages()[0];
    if (page) await page.screenshot({ path: "/tmp/bibo-live-display-failure.png", fullPage: true }).catch(() => undefined);
  }
} finally {
  await browser.close();
  clearTimeout(timeout);
  if (createdSessionId) {
    try {
      await cleanupSmokeSession(createdSessionId);
    } catch (error) {
      if (smokeError) console.error("Smoke cleanup also failed:", error);
      else smokeError = error;
    }
  }
}
if (smokeError) throw smokeError;
console.log(JSON.stringify(smokeResult));
