import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page } from "playwright";

const base = process.env.BIBO_SMOKE_BASE ?? "http://127.0.0.1:5198";
const server = process.env.BIBO_SMOKE_BASE ? null : spawn(process.execPath, [new URL("../node_modules/vite/bin/vite.js", import.meta.url).pathname, "preview", "--host", "127.0.0.1", "--port", "5198", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: ["ignore", "pipe", "pipe"] });
const ready = server ? new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Routing preview did not start")), 6000);
  server.stdout.on("data", (data: Buffer) => {
    if (!data.toString().includes(base)) return;
    clearTimeout(timeout); resolve();
  });
  server.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Routing preview exited with ${code}`)); });
  server.once("error", (error) => { clearTimeout(timeout); reject(error); });
}) : Promise.resolve();
const at = "2026-09-26T00:00:00.000Z";

async function mockNavigation(page: Page) {
  let sessionIds = ["a", "b"];
  const state = { creates: 0, delayB: false, waitingB: false, releaseB: () => {} };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const sessionId = url.searchParams.get("id");
    if (url.pathname === "/api/sessions/delete") {
      sessionIds = sessionIds.filter((id) => id !== route.request().postDataJSON().id);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (url.pathname === "/api/history" && sessionId === "b" && state.delayB) {
      state.waitingB = true;
      await new Promise<void>((resolve) => { state.releaseB = resolve; });
    }
    if (url.pathname === "/api/sessions" && route.request().method() === "POST") state.creates++;
    const action = route.request().method() === "POST" ? String(route.request().postDataJSON().action) : "";
    const response = url.pathname === "/api/auth/me" ? { user: { id: "routing-test", email: "test@example.com" } }
      : url.pathname === "/api/sessions" ? { sessions: sessionIds.map((id) => ({ id, title: `会话 ${id.toUpperCase()}`, createdAt: at, updatedAt: at, messageCount: 1 })) }
        : url.pathname === "/api/history" ? { messages: [{ role: "assistant", text: `正文 ${sessionId}`, at }] }
          : action === "overview.get" ? { result: { inbox: [], tasks: [], events: [], notes: [], projects: [], counts: { unread: 0, activeTasks: 0 } } }
            : { result: { items: [], nextCursor: null } };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(response) });
  });
  return {
    get creates() { return state.creates; },
    get waitingB() { return state.waitingB; },
    delayB: () => { state.delayB = true; },
    releaseB: () => { state.releaseB(); state.delayB = false; },
  };
}

async function sidebar(page: Page) {
  const menu = page.getByRole("button", { name: "打开菜单", exact: true });
  if (await menu.isVisible() && await menu.getAttribute("aria-expanded") !== "true") await menu.click();
  return page.locator(".bibo-sidebar:visible");
}

async function chooseSession(page: Page, title: string) {
  await (await sidebar(page)).getByRole("link", { name: title, exact: true }).click();
}

async function checkHistory(page: Page) {
  const input = page.getByRole("textbox", { name: /告诉 Bibo/ });
  await page.getByText("正文 a", { exact: true }).waitFor();
  await input.fill("A 的草稿");
  await (await sidebar(page)).getByRole("link", { name: "日程", exact: true }).click();
  await page.locator(".workspace-title").filter({ hasText: "日程" }).waitFor();
  await (await sidebar(page)).getByRole("link", { name: "对话", exact: true }).click();
  assert.equal(await input.inputValue(), "A 的草稿");
  await chooseSession(page, "会话 B");
  await page.getByText("正文 b", { exact: true }).waitFor();
  await input.fill("B 的草稿");
  await page.goBack();
  await page.getByText("正文 a", { exact: true }).waitFor();
  assert.equal(await input.inputValue(), "A 的草稿");
  await page.goForward();
  await page.getByText("正文 b", { exact: true }).waitFor();
  assert.equal(await input.inputValue(), "B 的草稿");
  await page.getByRole("button", { name: "＋ 新对话", exact: true }).click();
  await page.waitForURL(`${base}/?view=chat`);
  await page.locator(".bibo-welcome").waitFor();
  assert.equal(await page.locator(".ui-message").count(), 0);
  await page.goBack();
  await page.getByText("正文 b", { exact: true }).waitFor();
  await page.goForward();
  await page.waitForURL(`${base}/?view=chat`);
  await page.locator(".bibo-welcome").waitFor();
  assert.equal(await page.locator(".ui-message").count(), 0);
}

async function checkSelectionRace(page: Page, state: Awaited<ReturnType<typeof mockNavigation>>) {
  await chooseSession(page, "会话 A");
  await page.getByText("正文 a", { exact: true }).waitFor();
  state.delayB();
  await chooseSession(page, "会话 B");
  for (let attempt = 0; !state.waitingB && attempt < 50; attempt++) await page.waitForTimeout(20);
  assert.equal(state.waitingB, true);
  await chooseSession(page, "会话 A");
  await page.getByText("正文 a", { exact: true }).waitFor();
  state.releaseB();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByText("正文 b", { exact: true }).count(), 0);
  assert.equal(new URL(page.url()).searchParams.get("session"), "a");
}

async function verifyViewport(page: Page, width: number) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await mockNavigation(page);
  await page.goto(`${base}/?view=chat&session=a`, { waitUntil: "networkidle" });
  await checkHistory(page);
  await checkSelectionRace(page, state);
  await chooseSession(page, "会话 B");
  await page.getByText("正文 b", { exact: true }).waitFor();
  const row = (await sidebar(page)).locator(".bibo-session-wrap").filter({ has: page.getByRole("link", { name: "会话 B", exact: true }) });
  await row.getByRole("button", { name: "管理会话 会话 B" }).click();
  await page.getByRole("menuitem", { name: "删除会话" }).click();
  await page.getByRole("dialog", { name: "删除会话？" }).getByRole("button", { name: "删除会话", exact: true }).click();
  await page.getByText("正文 a", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("session"), "a");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("正文 a", { exact: true }).waitFor();
  const link = (await sidebar(page)).getByRole("link", { name: "会话 A", exact: true });
  assert.equal(await link.getAttribute("href"), "/?view=chat&session=a");
  for (const view of ["overview", "inbox", "calendar", "tasks", "notes", "files"]) {
    await page.goto(`${base}/${view === "overview" ? "" : `?view=${view}`}`, { waitUntil: "networkidle" });
    await sidebar(page);
    await page.locator(`.bibo-primary-nav [aria-current="page"][href*="${view === "overview" ? "/" : `view=${view}`}"]`).waitFor({ state: "attached" });
  }
  await page.goto(`${base}/?view=chat&session=missing`, { waitUntil: "networkidle" });
  await page.getByText("这段对话不存在或已删除。请选择其他对话，或新建对话。", { exact: true }).waitFor();
  assert.equal(await page.locator(".ui-message").count(), 0);
  assert.equal(state.creates, 0, "navigation must never create backend sessions");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `/tmp/bibo-routing-${width}.png` });
  console.log(`Routing ${width}: history, drafts, blank chat, direct links, refresh, race and missing session passed`);
}

try {
  await ready;
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 760 });
      try { await verifyViewport(page, width); } finally { await page.close(); }
    }
  } finally { await browser.close(); }
} finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
}
