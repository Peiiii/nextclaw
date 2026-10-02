import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Locator, type Page, type Route } from "playwright";
import { mockApi } from "./personal-workspace.fixture";

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
  let signedIn = true;
  const state = { creates: 0, delayB: false, waitingB: false, releaseB: () => {} };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const sessionId = url.searchParams.get("id");
    if (url.pathname === "/api/auth/logout") signedIn = false;
    if (url.pathname === "/api/auth/login") signedIn = true;
    if (url.pathname === "/api/auth/me" && !signedIn) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "请登录" }) });
    if (url.pathname === "/api/sessions") await new Promise((resolve) => setTimeout(resolve, 100));
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
    const response = url.pathname === "/api/auth/me" || url.pathname === "/api/auth/login" ? { user: { id: "routing-test", email: "test@example.com" } }
      : url.pathname === "/api/auth/logout" ? { ok: true }
      : url.pathname === "/api/runs" ? { run: null, activeRuns: [] }
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
  const menu = page.locator(".bibo-menu-button");
  if (page.viewportSize()!.width <= 760) {
    await page.locator('.ui-overlay--sheet[data-state="closed"]').filter({ has: page.locator(".bibo-sidebar") }).waitFor({ state: "detached" });
    if (await menu.getAttribute("aria-expanded") !== "true") {
      const trigger = await menu.isVisible() ? menu : page.locator(".bibo-mobile-nav").getByRole("button", { name: "更多", exact: true });
      await trigger.click();
    }
  }
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
  await page.getByRole("button", { name: "新对话", exact: true }).click();
  await page.waitForURL(`${base}/chat`);
  await page.locator(".bibo-welcome").waitFor();
  assert.equal(await page.locator(".ui-message").count(), 0);
  await page.goBack();
  await page.getByText("正文 b", { exact: true }).waitFor();
  await page.goForward();
  await page.waitForURL(`${base}/chat`);
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
  assert.equal(new URL(page.url()).pathname.split("/").at(-1), "a");
}

async function checkDeletion(page: Page) {
  await chooseSession(page, "会话 B");
  await page.getByText("正文 b", { exact: true }).waitFor();
  const row = (await sidebar(page)).locator(".bibo-session-wrap").filter({ has: page.getByRole("link", { name: "会话 B", exact: true }) });
  await row.getByRole("button", { name: "管理会话 会话 B" }).click();
  await page.getByRole("menuitem", { name: "删除会话" }).click();
  await page.getByRole("dialog", { name: "删除会话？" }).getByRole("button", { name: "删除会话", exact: true }).click();
  await page.getByText("正文 a", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname.split("/").at(-1), "a");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("正文 a", { exact: true }).waitFor();
  const link = (await sidebar(page)).getByRole("link", { name: "会话 A", exact: true });
  assert.equal(await link.getAttribute("href"), "/chat/a");
}

async function checkLogin(page: Page) {
  await (await sidebar(page)).getByRole("button", { name: "账号与帮助" }).click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  await page.locator(".bibo-auth-card").waitFor();
  await page.goto(`${base}/chat/a`, { waitUntil: "networkidle" });
  const auth = page.locator(".bibo-auth-card");
  assert.equal(await auth.getAttribute("role"), "dialog");
  assert.equal(await page.locator("main").evaluate((element) => (element as HTMLElement).inert), true, "background navigation is unavailable during authentication");
  if (page.viewportSize()!.width < 761) {
    const box = (await auth.boundingBox())!;
    assert.equal(box.x, 0, "mobile authentication owns the whole viewport");
    assert.equal(box.width, page.viewportSize()!.width);
  }
  await auth.getByRole("button", { name: "登录", exact: true }).first().click();
  await auth.getByRole("textbox", { name: "邮箱", exact: true }).fill("test@example.com");
  if (page.viewportSize()!.width < 761) {
    assert.equal(await auth.getByLabel("密码", { exact: true }).count(), 0, "mobile starts with one focused email step");
    await auth.locator('button[type="submit"]').click();
    await auth.getByLabel("密码", { exact: true }).waitFor();
  }
  await auth.getByLabel("密码", { exact: true }).fill("test-password");
  await auth.locator('button[type="submit"]').click();
  await auth.waitFor({ state: "hidden" });
  assert.equal(await page.locator("main").evaluate((element) => (element as HTMLElement).inert), false);
  await page.getByText("正文 a", { exact: true }).waitFor();
}

async function verifyViewport(page: Page, width: number) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.body?.innerText.includes("正在打开…")) document.documentElement.dataset.startupTextShown = "true";
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  const state = await mockNavigation(page);
  await page.goto(`${base}/chat/a`, { waitUntil: "networkidle" });
  await checkHistory(page);
  await checkSelectionRace(page, state);
  await checkDeletion(page);
  await checkLogin(page);
  for (const view of ["overview", "inbox", "calendar", "tasks", "notes", "files"]) {
    await page.goto(`${base}/${view === "overview" ? "" : view}`, { waitUntil: "networkidle" });
    await sidebar(page);
    await page.locator(`.bibo-primary-nav [aria-current="page"][href*="${view === "overview" ? "/" : view}"]`).waitFor({ state: "attached" });
  }
  await page.goto(`${base}/chat/missing`, { waitUntil: "networkidle" });
  await page.getByText("这段对话不存在或已删除。请选择其他对话，或新建对话。", { exact: true }).waitFor();
  assert.equal(await page.locator(".ui-message").count(), 0);
  assert.equal(state.creates, 0, "navigation must never create backend sessions");
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.startupTextShown), "true", "cold entry must not flash a separate opening page");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `/tmp/bibo-routing-${width}.png` });
  console.log(`Routing ${width}: history, drafts, blank chat, direct links, refresh, race and missing session passed`);
}

class ResourceRoutingFixture {
  readonly calls: Array<{ action: string; input: Record<string, unknown> }> = [];
  readonly chunks: string[] = [];
  readonly pendingLists: Array<() => void> = [];
  readonly pendingDetails: Array<() => void> = [];
  private listsHeld = false;
  private detailHeld = false;
  private slowDetail = () => {};
  holdLists = (value: boolean): void => { this.listsHeld = value; };
  holdDetail = (value: boolean): void => { this.detailHeld = value; };
  releaseLists = (): void => { this.pendingLists.splice(0).forEach(release => release()); };
  releaseDomainDetails = (): void => { this.pendingDetails.splice(0).forEach(release => release()); };
  releaseDetail = (): void => { this.slowDetail(); };
  private respond = async (route: Route): Promise<void> => {
    const body = route.request().postDataJSON();
    this.calls.push(body);
    if (body.action.endsWith(".list") && this.listsHeld) await new Promise<void>(resolve => this.pendingLists.push(resolve));
    if (this.detailHeld && ["task.get", "event.get", "inbox.get"].includes(body.action)) await new Promise<void>(resolve => this.pendingDetails.push(resolve));
    if (body.action === "file.get" && body.input.id === "nested-note") return route.fulfill({ json: { result: { id: "nested-note", path: "笔记/nested.md", kind: "note", content: "# 嵌套正文", version: 1, uri: "nextclaw://objects/file/nested-note", createdAt: at, updatedAt: at } } });
    if (body.action === "file.get" && body.input.id === "slow") {
      if (this.detailHeld) await new Promise<void>(resolve => { this.slowDetail = resolve; });
      return route.fulfill({ json: { result: { id: "slow", path: "slow.md", kind: "note", content: "迟到的正文", version: 1, uri: "nextclaw://objects/file/slow", createdAt: at, updatedAt: at } } });
    }
    return route.fallback();
  };
  bind = async (page: Page): Promise<void> => {
    page.on("request", request => { if (request.url().includes("/assets/")) this.chunks.push(request.url()); });
    await mockApi(page);
    await page.route("**/api/space", this.respond);
    await page.addInitScript(() => localStorage.setItem("space-layout:smoke", JSON.stringify({ tabs: ["file-a", "slow"], activeFileId: "file-a", workspaceOpen: true, workspaceFileId: "slow" })));
  };
}

type ResourceFixture = ResourceRoutingFixture;

async function checkNoteCollection(page: Page, { calls, chunks }: ResourceFixture) {
  await page.goto(`${base}/notes`, { waitUntil: "networkidle" });
  await page.locator(".bibo-note-list").waitFor();
  assert.equal(calls.filter(call => call.action === "file.get").length, 0, "notes collection never restores old document or hidden chat workspace");
  assert.deepEqual(calls.filter(call => call.action === "file.list").map(call => call.input.kind), ["note"], "notes only requests its own list");
  assert.equal(chunks.some(url => /(?:tasks-view|calendar-view|inbox-view|overview-view)-/.test(url)), false, "unvisited page chunks remain unloaded");
  await (await sidebar(page)).getByRole("link", { name: "想法", exact: true }).click();
  await page.waitForURL(`${base}/notes/file-a`);
  await page.locator(".bibo-file-editor").waitFor();
  assert.equal(await page.locator(".bibo-note-list").count(), 0);
  await page.goBack();
  await page.locator(".bibo-note-list").waitFor();
  await page.goForward();
  await page.locator(".bibo-file-editor").waitFor();
}

async function checkNoteDemand(page: Page, fixture: ResourceFixture) {
  const { calls, pendingLists } = fixture;
  fixture.holdLists(true);
  const before = calls.length;
  await page.goto(`${base}/notes/file-a`, { waitUntil: "domcontentloaded" });
  await page.locator(".bibo-file-editor").waitFor();
  assert.equal(pendingLists.length, 1, "detail completes while the notes list is pending");
  assert.equal(calls.slice(before).filter(call => call.action === "file.get").length, 1, "direct entry reads its target once");
  assert.equal(await page.locator(".bibo-note-list").count(), 0);
  fixture.holdLists(false); pendingLists.splice(0).forEach(release => release());
  await page.waitForLoadState("networkidle");
  fixture.holdDetail(true);
  await (await sidebar(page)).getByRole("link", { name: "笔记", exact: true }).click();
  await page.locator(".bibo-note-list").waitFor();
  // Use the real history API to exercise a detail absent from the list.
  await page.evaluate(() => { history.pushState(null, "", "/notes/slow"); dispatchEvent(new PopStateEvent("popstate")); });
  await page.getByRole("status", { name: "正在打开文件", exact: true }).waitFor();
  assert.equal(await page.locator(".bibo-note-list").count(), 0);
  await (await sidebar(page)).getByRole("link", { name: "笔记", exact: true }).click();
  await page.locator(".bibo-note-list").waitFor();
  fixture.releaseDetail(); fixture.holdDetail(false);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator(".bibo-file-editor").count(), 0, "late detail cannot leave the collection");
}

async function checkFileEntries(page: Page, fixture: ResourceFixture) {
  const { calls } = fixture;
  await page.goto(`${base}/files`, { waitUntil: "networkidle" });
  assert.equal(calls.slice(-1)[0]?.action, "file.list");
  assert.equal(await page.locator(".bibo-file-editor").count(), 0, "files collection ignores persisted selection");
  await page.goto(`${base}/files/file-a`, { waitUntil: "networkidle" });
  await page.locator(".bibo-file-editor").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".bibo-file-editor").waitFor();
  await page.goto(`${base}/files/missing`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "重试打开", exact: true }).waitFor();
  fixture.holdLists(true);
  await page.goto(`${base}/files/nested-note`, { waitUntil: "domcontentloaded" });
  await page.locator(".bibo-file-editor").waitFor();
  assert.ok(fixture.pendingLists.length, "nested file renders before directory reads finish");
  fixture.holdLists(false); fixture.releaseLists();
  await page.waitForLoadState("networkidle");
}

async function checkDomainRoutes(page: Page, fixture: ResourceFixture, width: number) {
  for (const [view, id, title, close] of [
    ["tasks", "task-a", "梳理产品方案", "关闭任务详情"],
    ["calendar", "event-a", "编辑日程", "关闭日程编辑"],
    ["inbox", "inbox-a", "确认方案方向", "← 全部消息"],
  ]) {
    fixture.holdLists(true);
    fixture.holdDetail(true);
    await page.goto(`${base}/${view}/${id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("status", { name: "正在打开详情", exact: true }).waitFor();
    assert.equal(fixture.pendingDetails.length, 1, "direct entry starts detail without waiting for a list");
    fixture.holdDetail(false); fixture.releaseDomainDetails();
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    if (view === "calendar") await page.getByRole("textbox", { name: "标题", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, `/${view}/${id}`, "opening a resource retains its URL");
    assert.ok(fixture.pendingLists.length, `${view} detail is independent of its list`);
    fixture.holdLists(false); fixture.releaseLists();
    await page.waitForLoadState("networkidle");
    if (view === "inbox" && width >= 760) await (await sidebar(page)).getByRole("link", { name: "收件箱", exact: true }).click();
    else await page.getByRole("button", { name: close, exact: true }).click();
    await page.waitForURL(`${base}/${view}`);
    await page.goBack();
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    await page.goForward();
    await page.waitForURL(`${base}/${view}`);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByRole("dialog").count(), 0, "collection refresh never restores a closed detail");
  }
}

async function verifyResourceRouting(page: Page, width: number) {
  const fixture = new ResourceRoutingFixture();
  await fixture.bind(page);
  await checkNoteCollection(page, fixture);
  await checkNoteDemand(page, fixture);
  await checkFileEntries(page, fixture);
  await checkDomainRoutes(page, fixture, width);
  await checkDomainFailure(page, fixture);
  await checkInboxSource(page, fixture);
  await page.screenshot({ path: `/tmp/bibo-resource-routing-${width}.png` });
  console.log(`Resource routing ${width}: persistent collection, lazy chunks, direct detail before list, history, refresh, delayed response and failure passed`);
}

async function checkInboxSource(page: Page, { calls }: ResourceFixture) {
  await page.goto(`${base}/inbox/inbox-a`, { waitUntil: "networkidle" });
  const before = calls.length;
  await page.getByRole("button", { name: "查看来源 ↗", exact: true }).click();
  await page.waitForURL(`${base}/tasks/task-a`);
  await page.getByRole("heading", { name: "梳理产品方案", exact: true }).waitFor();
  assert.equal(calls.slice(before).filter(call => call.action === "task.get").length, 1, "source navigation reads through the target route once");
}

async function checkDomainFailure(page: Page, fixture: ResourceFixture) {
  for (const [view, action, id, title] of [["tasks", "task.get", "task-a", "梳理产品方案"], ["calendar", "event.get", "event-a", "编辑日程"], ["inbox", "inbox.get", "inbox-a", "确认方案方向"]]) {
    let failed = false;
    const failOnce = async (route: Route) => {
      if (failed || route.request().postDataJSON().action !== action) return route.fallback();
      failed = true;
      return route.fulfill({ status: 503, json: { error: "路由详情读取失败" } });
    };
    fixture.holdLists(true);
    await page.route("**/api/space", failOnce);
    await page.goto(`${base}/${view}/${id}`, { waitUntil: "domcontentloaded" });
    const scope = view === "inbox" ? page.locator(".bibo-detail-pane") : page.getByRole("dialog");
    await scope.getByText("路由详情读取失败", { exact: true }).waitFor();
    await scope.getByRole("button", { name: "重试打开", exact: true }).click();
    if (view === "calendar") await scope.getByRole("textbox", { name: "标题", exact: true }).waitFor();
    else await scope.getByRole("heading", { name: title, exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, `/${view}/${id}`, "retry retains the target URL");
    fixture.holdLists(false); fixture.releaseLists();
    await page.waitForLoadState("networkidle");
    await page.unroute("**/api/space", failOnce);
  }
}

async function checkMobileAuthLayout(page: Page, auth: Locator, submit: Locator): Promise<void> {
  const [story, mascot, copy, form, note, action] = await Promise.all([
    auth.locator(".bibo-auth-story").boundingBox(), auth.locator(".bibo-auth-companion").boundingBox(),
    auth.locator(".bibo-auth-story-copy").boundingBox(), auth.locator(".bibo-auth-form-pane").boundingBox(),
    auth.locator(".bibo-auth-note").boundingBox(), submit.boundingBox(),
  ]);
  assert.ok(story && mascot && copy && form && note && action);
  assert.ok(mascot.y >= story.y && mascot.y + mascot.height <= form.y - 12, "the companion stays complete above the form");
  assert.ok(mascot.y + mascot.height <= copy.y - 12, "the companion has breathing room above the centered welcome copy");
  assert.ok(note.y - (action.y + action.height) <= 24, "the note follows the primary action without a blank panel");
  assert.ok(note.y + note.height <= page.viewportSize()!.height, "the note stays on the first screen");
  assert.equal(await auth.evaluate((card) => card.scrollHeight <= card.clientHeight + 1 && document.documentElement.scrollWidth <= innerWidth), true, "the initial mobile form has no viewport overflow");
}

async function checkShortViewportAction(page: Page, submit: Locator, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 380 });
  await submit.scrollIntoViewIfNeeded();
  const box = await submit.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 380, "keyboard-height view can scroll to the primary action");
}

async function verifyCompactAuth(page: Page, width: number) {
  let codeRequests = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/send-code") {
      codeRequests++;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ maskedEmail: "t***@example.com" }) });
    }
    return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "请登录" }) });
  });
  await page.goto(base, { waitUntil: "networkidle" });
  const auth = page.locator(".bibo-auth-card");
  await auth.waitFor();
  const submit = auth.locator('button[type="submit"]');
  const assertActionFits = async () => {
    const box = await submit.boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize()!.height, `${width}px primary action must fit without scrolling`);
    const mascot = await auth.locator(".bibo-auth-companion").boundingBox();
    const form = await auth.locator(".bibo-auth-form-pane").boundingBox();
    assert.ok(mascot && form && mascot.y + mascot.height <= form.y - 12, "the companion stays complete through both authentication steps");
  };
  await checkMobileAuthLayout(page, auth, submit);
  await assertActionFits();
  assert.equal(await auth.getByLabel("密码", { exact: true }).count(), 0);
  await auth.getByRole("textbox", { name: "邮箱", exact: true }).fill("test@example.com");
  await submit.click();
  await auth.getByLabel("密码", { exact: true }).waitFor();
  await auth.getByLabel("邮箱验证码", { exact: true }).waitFor();
  await auth.getByText("验证码已发往", { exact: false }).waitFor();
  assert.equal(codeRequests, 1);
  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/send-code"),
    auth.getByRole("button", { name: "重新发送" }).click(),
  ]);
  assert.equal(codeRequests, 2);
  await assertActionFits();
  await page.screenshot({ path: `/tmp/bibo-auth-details-${width}.png` });
  await auth.getByRole("button", { name: "修改" }).click();
  assert.equal(await auth.getByRole("textbox", { name: "邮箱", exact: true }).inputValue(), "test@example.com");
  await auth.getByRole("button", { name: "登录", exact: true }).click();
  await submit.click();
  await auth.getByLabel("密码", { exact: true }).waitFor();
  assert.equal(await auth.getByLabel("邮箱验证码", { exact: true }).count(), 0);
  await assertActionFits();
  if (width === 320) await checkShortViewportAction(page, submit, width);
  console.log(`Auth ${width}: email, code delivery, details, edit and login fit without scrolling`);
}

try {
  await ready;
  const browser = await chromium.launch();
  try {
    for (const width of process.env.BIBO_ROUTING_WIDTH ? [Number(process.env.BIBO_ROUTING_WIDTH)] : [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 760 });
      try { await verifyViewport(page, width); }
      catch (error) { await page.screenshot({ path: `/tmp/bibo-routing-failure-${width}.png` }); throw error; }
      finally { await page.close(); }
      const resources = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 760 });
      try { await verifyResourceRouting(resources, width); }
      catch (error) { await resources.screenshot({ path: `/tmp/bibo-resource-routing-failed-${width}.png` }); console.log(await resources.evaluate(() => ({ path: location.pathname, menu: document.querySelector(".bibo-menu-button")?.outerHTML, sidebar: document.querySelector(".bibo-sidebar")?.closest(".ui-overlay")?.outerHTML.slice(0, 500) }))); throw error; }
      finally { await resources.close(); }
    }
    for (const width of [390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 844 }, hasTouch: true });
      try { await verifyCompactAuth(page, width); } finally { await page.close(); }
    }
  } finally { await browser.close(); }
} finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
}
