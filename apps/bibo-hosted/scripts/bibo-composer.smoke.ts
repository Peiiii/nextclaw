import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page } from "playwright";

const base = process.env.BIBO_SMOKE_BASE ?? "http://127.0.0.1:5197";
const server = process.env.BIBO_SMOKE_BASE ? null : spawn(process.execPath, [new URL("../node_modules/vite/bin/vite.js", import.meta.url).pathname, "preview", "--host", "127.0.0.1", "--port", "5197", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: ["ignore", "pipe", "pipe"] });
const ready = server ? new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Composer preview did not start")), 6000);
  server.stdout.on("data", (data: Buffer) => {
    if (!data.toString().includes(base)) return;
    clearTimeout(timeout);
    resolve();
  });
  server.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Composer preview exited with ${code}`)); });
  server.once("error", (error) => { clearTimeout(timeout); reject(error); });
}) : Promise.resolve();
const at = "2026-09-26T00:00:00.000Z";
const session = { id: "composer", title: "输入面板验证", createdAt: at, updatedAt: at, messageCount: 0 };
type MockState = { cancels: number; creates: number; failCancel: boolean; messages: { role: string; text: string; at: string }[] };
const controls = (page: Page) => ({
  input: page.getByRole("textbox", { name: /告诉 Bibo/ }),
  send: page.getByRole("button", { name: "发送消息", exact: true }),
  stop: page.getByRole("button", { name: "停止生成", exact: true }),
});

async function frame(page: Page, name: string, value: unknown): Promise<void> {
  await page.evaluate(({ name, value }) => window.dispatchEvent(new CustomEvent("composer-frame", { detail: { name, value } })), { name, value });
}

async function setupComposer(page: Page, width: number): Promise<MockState> {
  const state: MockState = { cancels: 0, creates: 0, failCancel: true, messages: [] };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/chat/availability") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (path === "/api/sessions" && route.request().method() === "POST") {
      state.creates += 1;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ session }) });
    }
    const action = route.request().method() === "POST" ? String(route.request().postDataJSON().action) : "";
    const value = path === "/api/auth/me" ? { user: { id: "composer-test", email: "test@example.com" } }
      : path === "/api/sessions" ? { sessions: [session] }
        : path === "/api/history" ? { messages: state.messages }
          : action === "overview.get" ? { result: { inbox: [], tasks: [], events: [], notes: [], projects: [], counts: { unread: 0, activeTasks: 0 } } }
            : { result: { items: [], nextCursor: null } };
    if (path === "/api/cancel") {
      state.cancels += 1;
      return route.fulfill({ status: state.failCancel ? 503 : 200, contentType: "application/json", body: JSON.stringify(state.failCancel ? { error: "停止失败，请重试" } : { ok: true }) });
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(value) });
  });
  await page.addInitScript({ content: String.raw`(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      if (!String(args[0]).includes("/api/chat") || String(args[0]).includes("/api/chat/")) return originalFetch(...args);
      const stream = new ReadableStream({
        start(controller) {
          document.documentElement.dataset.composerStream = "ready";
          document.documentElement.dataset.composerRuns = String(Number(document.documentElement.dataset.composerRuns ?? 0) + 1);
          const receive = (event) => {
            const { name, value } = event.detail;
            controller.enqueue(new TextEncoder().encode("event: " + name + "\ndata: " + JSON.stringify(value) + "\n\n"));
            if (name === "committed" || name === "error") {
              window.removeEventListener("composer-frame", receive);
              delete document.documentElement.dataset.composerStream;
              controller.close();
            }
          };
          window.addEventListener("composer-frame", receive);
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    };
  })()` });
  await page.goto(`${base}/?view=chat${width < 760 ? "" : "&session=composer"}`);
  return state;
}

async function checkGeneration(page: Page, width: number, state: MockState): Promise<void> {
  const { input, send, stop } = controls(page);
  await input.waitFor();
  assert.ok(await send.isDisabled());
  await input.fill("原始问题");
  await input.evaluate((element) => element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing: true })));
  assert.equal(await page.locator(".ui-message--pending").count(), 0, "IME confirmation must not send");
  await send.click();
  assert.equal(await input.inputValue(), "");
  await input.fill("下一条草稿");
  await page.waitForFunction(() => document.documentElement.dataset.composerStream === "ready");
  await page.getByRole("button", { name: "正在连接…", exact: true }).waitFor();
  await input.press("Enter");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.composerRuns), "1", "Enter during a run must not send concurrently");
  await frame(page, "accepted", { runId: "run-1" });
  await stop.waitFor();
  assert.equal(await page.locator(".ui-composer__actions button").count(), 1);
  assert.equal(await stop.innerText(), "");
  assert.equal(await stop.evaluate((element) => getComputedStyle(element).color), "rgb(255, 255, 255)", "the stop icon must retain contrast, including hover");
  await frame(page, "delta", { text: "这是一段正在生成的回答。" });
  await page.getByText("这是一段正在生成的回答。", { exact: true }).waitFor();
  await page.screenshot({ path: `/tmp/bibo-composer-generating-${width}.png` });
  await frame(page, "saving", {});
  assert.ok(await page.getByRole("button", { name: "正在保存…", exact: true }).isDisabled());
  assert.equal(await stop.count(), 0);
  state.messages = [{ role: "user", text: "原始问题", at }, { role: "assistant", text: "这是一段正在生成的回答。", at }];
  await frame(page, "committed", { text: state.messages[1]!.text, messages: state.messages, session });
  await send.waitFor();
  assert.equal(await input.inputValue(), "下一条草稿", "successful completion preserves the next draft");
  assert.equal(state.creates, width < 760 ? 1 : 0, "first send creates exactly one session");
}

async function checkCancellation(page: Page, state: MockState): Promise<void> {
  const { input, send, stop } = controls(page);
  await send.click();
  await page.waitForFunction(() => document.documentElement.dataset.composerStream === "ready");
  await input.fill("新的下一条");
  await frame(page, "accepted", { runId: "run-2" });
  await stop.click();
  await page.getByText("停止失败，请重试", { exact: true }).waitFor();
  assert.ok(await stop.isEnabled(), "failed cancellation must remain retryable");
  state.failCancel = false;
  await stop.click();
  assert.ok(await page.getByRole("button", { name: "正在停止…", exact: true }).isDisabled());
  assert.equal(state.cancels, 2, "only one cancellation request per click");
  await frame(page, "error", { error: "生成已停止，本轮未保存。" });
  const retry = page.getByRole("button", { name: "重试消息", exact: true });
  await retry.waitFor();
  assert.equal(await input.inputValue(), "新的下一条", "failure must not overwrite the next draft");
  await retry.click();
  await page.waitForFunction(() => document.documentElement.dataset.composerStream === "ready");
  assert.equal(await page.locator(".ui-message--pending.ui-message--user").innerText(), "你\n下一条草稿");
  await frame(page, "accepted", { runId: "run-3" });
  await frame(page, "saving", {});
  state.messages = [...state.messages, { role: "user", text: "下一条草稿", at }, { role: "assistant", text: "重试成功。", at }];
  await frame(page, "committed", { text: "重试成功。", messages: state.messages, session });
  await send.waitFor();
  assert.equal(await retry.count(), 0);
  assert.equal(await input.inputValue(), "新的下一条");
}

async function checkDraftEditor(page: Page): Promise<void> {
  const { input, send } = controls(page);
  await input.fill(Array.from({ length: 20 }, (_, index) => `第${index + 1}行`).join("\n"));
  assert.ok((await input.boundingBox())!.height <= 170, "the editor grows only to its height limit");
  assert.ok(await input.evaluate((element) => element.scrollHeight > element.clientHeight), "long drafts scroll inside the editor");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await input.fill("没有下一条草稿时的失败问题");
  await send.click();
  await page.waitForFunction(() => document.documentElement.dataset.composerStream === "ready");
  await frame(page, "error", { error: "连接中断，未保存。" });
  await send.waitFor();
  assert.equal(await input.inputValue(), "没有下一条草稿时的失败问题", "an empty editor restores the failed input");
}

async function checkFailureQueue(page: Page): Promise<void> {
  const { input, send } = controls(page);
  for (const nextDraft of ["第二条失败问题", "第三条草稿"]) {
    await send.click();
    await page.waitForFunction(() => document.documentElement.dataset.composerStream === "ready");
    await input.fill(nextDraft);
    await frame(page, "error", { error: "连接中断，未保存。" });
    await send.waitFor();
  }
  const retry = page.getByRole("button", { name: "重试消息 (2)", exact: true });
  await retry.click();
  await page.waitForFunction(() => document.documentElement.dataset.composerStream === "ready");
  assert.match(await page.locator(".ui-message--pending.ui-message--user").innerText(), /没有下一条草稿时的失败问题/, "repeated failures must retain the earlier message");
  assert.equal(await input.inputValue(), "第三条草稿");
  await frame(page, "error", { error: "连接中断，未保存。" });
  await retry.waitFor();
}

async function verifyViewport(page: Page, width: number): Promise<void> {
  const errors: string[] = [];
  page.setDefaultTimeout(8000);
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const state = await setupComposer(page, width);
    await checkGeneration(page, width, state);
    await checkCancellation(page, state);
    await checkDraftEditor(page);
    await checkFailureQueue(page);
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({ path: `/tmp/bibo-composer-failure-${width}.png` });
    if (errors.length) throw new Error(errors.join("\n"), { cause: error });
    throw error;
  } finally { await page.close(); }
}

try {
  await ready;
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 760 });
      await verifyViewport(page, width);
    }
  } finally { await browser.close(); }
} finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
}
