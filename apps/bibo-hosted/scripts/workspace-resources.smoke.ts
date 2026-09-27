import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page, type Route, type Locator, type Browser } from "playwright";
import { mockApi } from "./personal-workspace.fixture";

const base = process.env.RESOURCE_SMOKE_ORIGIN ?? "http://127.0.0.1:5394";
const server = process.env.RESOURCE_SMOKE_ORIGIN ? null : spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5394", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
const reply = "[产物](nextclaw://objects/file/artifact-a) · [笔记](nextclaw://objects/file/file-a) · [路径引用](nextclaw://file/workspace/report.html) · [外部网站](https://example.com) · [未知资源](nextclaw://unknown/example) · [失效文件](nextclaw://objects/file/deleted) · [任务引用](nextclaw://objects/task/task-a) · [日程引用](nextclaw://objects/event/event-a) · [送达引用](nextclaw://objects/inbox-delivery/outside-inbox) · [危险](javascript:alert(1))";
let artifact = { id: "artifact-a", path: "report.html", kind: "artifact", uri: "nextclaw://objects/file/artifact-a", content: "<h1>成果预览</h1><p>图表方案</p>", version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

async function fixtures(page: Page) {
  let delivery = { id: "outside-inbox", kind: "decision", title: "列表以外的送达", body: "来自资源引用", source: { kind: "bibo" }, version: 1, readAt: null as string | null, resolvedAt: null as string | null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await mockApi(page);
  await page.route("**/api/history*", (route) => route.fulfill({ json: { messages: [{ role: "assistant", text: reply, at: new Date().toISOString() }] } }));
  await page.route("**/api/space", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "inbox.get" && body.input.id === delivery.id) return route.fulfill({ json: { result: delivery } });
    if (["inbox.read", "inbox.resolve"].includes(body.action) && body.input.id === delivery.id) {
      assert.equal(body.input.version, delivery.version);
      delivery = { ...delivery, readAt: new Date().toISOString(), resolvedAt: body.action === "inbox.resolve" ? new Date().toISOString() : null, version: delivery.version + 1 };
      return route.fulfill({ json: { result: delivery } });
    }
    if (body.action === "file.get" && (body.input.id === "artifact-a" || body.input.path === artifact.path)) return route.fulfill({ json: { result: artifact } });
    if (body.action === "file.get" && body.input.id === "deleted") return route.fulfill({ status: 404, json: { error: "文件不存在。" } });
    if (body.action === "file.list" && body.input.query === "report.html") return route.fulfill({ json: { result: { items: [artifact], nextCursor: null } } });
    if (body.action === "file.update" && body.input.id === "artifact-a") {
      artifact = { ...artifact, content: body.input.content, version: artifact.version + 1 };
      return route.fulfill({ json: { result: artifact } });
    }
    await route.fallback();
  });
}

async function ready() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(`Resource preview exited: ${server.exitCode}`);
    try { if ((await fetch(base)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Resource preview did not start");
}

async function verifyEdits(page: Page, workspace: Locator, link: Locator) {
  await workspace.getByRole("button", { name: "编辑", exact: true }).click();
  const editor = workspace.getByRole("textbox", { name: "编辑 report.html" });
  await editor.fill("<h1>保存后的产物</h1>");
  await workspace.getByRole("button", { name: "保存", exact: true }).click();
  await workspace.getByText("已保存", { exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await link.click();
  await workspace.frameLocator("iframe").getByRole("heading", { name: "保存后的产物" }).waitFor();
  await workspace.getByRole("button", { name: "编辑", exact: true }).click();
  await editor.fill("<h1>未保存的草稿</h1>");
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await link.click();
  await workspace.getByRole("button", { name: "编辑", exact: true }).click();
  assert.equal(await editor.inputValue(), "<h1>未保存的草稿</h1>", "resource reopen preserves unsaved edits");
  await editor.fill("<h1>保存后的产物</h1>");
  await page.getByRole("button", { name: "关闭工作区" }).click();
}

async function verifyFailures(page: Page, workspace: Locator) {
  await page.getByRole("link", { name: "未知资源", exact: true }).click();
  await workspace.getByText("此资源暂不支持打开。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await page.getByRole("link", { name: "失效文件", exact: true }).click();
  await workspace.getByText("文件不存在。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await page.getByRole("link", { name: "路径引用", exact: true }).click();
  await workspace.frameLocator("iframe").getByRole("heading", { name: "保存后的产物" }).waitFor();
}

async function verifyConcurrency(page: Page, workspace: Locator, link: Locator) {
  for (const close of [false, true]) {
    await page.getByRole("button", { name: "关闭工作区" }).click();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const requested = new Promise<void>((resolve) => { started = resolve; });
    const hold = async (route: Route) => {
      const body = route.request().postDataJSON();
      if (body.action === "file.get" && body.input.id === "artifact-a") { started(); await gate; }
      await route.fallback();
    };
    await page.route("**/api/space", hold);
    try {
      await link.click();
      await requested;
      await workspace.getByRole("status", { name: "正在打开资源" }).waitFor();
      if (close) await page.getByRole("button", { name: "关闭工作区" }).click();
      else {
        await page.locator('.ui-markdown a[href="/files/file-a"]').click();
        await workspace.getByRole("textbox", { name: "编辑 想法.md" }).waitFor();
      }
      const response = page.waitForResponse((response) => response.url().endsWith("/api/space") && response.request().postDataJSON().action === "file.get" && response.request().postDataJSON().input.id === "artifact-a");
      release();
      await (await response).finished();
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      if (close) assert.equal(await workspace.count(), 0, "late results do not reopen a closed workspace");
      else assert.equal(await workspace.getByRole("combobox", { name: "工作区文件" }).inputValue(), "file-a", "slow A never replaces the later B selection");
    } finally { release(); await page.unroute("**/api/space", hold); }
  }
}

async function verifyStandalone(page: Page) {
  await page.goto(`${base}/files/artifact-a`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "编辑 report.html" }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "编辑 report.html" }).waitFor();
}

async function verifyModules(page: Page) {
  for (const [name, path, title] of [["任务引用", "/tasks", "梳理产品方案"], ["日程引用", "/calendar", "设计评审"], ["送达引用", "/inbox", "列表以外的送达"]]) {
    await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
    const close = page.getByRole("button", { name: "关闭工作区" });
    if (await close.count()) await close.click();
    await page.getByRole("link", { name, exact: true }).click();
    await page.waitForURL(`**${path}`);
    if (path === "/inbox") {
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      await page.getByRole("button", { name: "标记已读", exact: true }).click();
      await page.getByRole("button", { name: "标记已读", exact: true }).waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "已处理", exact: true }).click();
      await page.getByText(/^已处理 ·/).waitFor();
    } else await page.getByRole("textbox", { name: path === "/tasks" ? "任务名称" : "标题", exact: true }).waitFor();
  }
}

async function verifyWidth(browser: Browser, width: number) {
  artifact = { ...artifact, content: "<h1>成果预览</h1><p>图表方案</p>", version: 1 };
  const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 760 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixtures(page);
  await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
  const link = page.getByRole("link", { name: "产物", exact: true });
  await link.waitFor({ timeout: 5000 }).catch(async (error) => {
    console.error({ url: page.url(), pageErrors: errors, body: (await page.locator("body").innerText()).slice(0, 2000) });
    throw error;
  });
  assert.equal(await link.getAttribute("href"), "/files/artifact-a");
  assert.equal(await page.locator('.ui-markdown a:not([aria-disabled="true"])').filter({ hasText: /^危险$/ }).count(), 0);
  const external = page.getByRole("link", { name: "外部网站", exact: true });
  assert.equal(await external.getAttribute("target"), "_blank");
  assert.equal(await link.evaluate((element) => getComputedStyle(element).textDecorationLine), "underline");
  await link.click();
  const workspace = page.getByRole("complementary", { name: "右侧工作区" });
  await workspace.waitFor();
  await workspace.frameLocator("iframe").getByRole("heading", { name: /成果预览|保存后的产物/ }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/chat/session-a", "opening a resource retains the conversation");
  await page.screenshot({ path: `/tmp/workspace-resource-${width}.png` });
  await verifyEdits(page, workspace, link);
  await verifyFailures(page, workspace);
  if (width === 1440) await verifyConcurrency(page, workspace, link);
  await verifyStandalone(page);
  await verifyModules(page);
  assert.deepEqual(errors, []);
  await page.close();
  console.log("workspace resources verified", width);
}

async function main() {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390, 320]) await verifyWidth(browser, width);
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
});
