import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page, type Route, type Locator, type Browser } from "playwright";
import { mockApi } from "./personal-workspace.fixture";

const base = process.env.RESOURCE_SMOKE_ORIGIN ?? "http://127.0.0.1:5394";
const server = process.env.RESOURCE_SMOKE_ORIGIN ? null : spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5394", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
const reply = "[产物](nextclaw://objects/file/artifact-a) · [笔记](nextclaw://objects/file/file-a) · [路径引用](nextclaw://file/workspace/report.html) · [搭档启动卡.md](/data/workspace/搭档启动卡.md) · [相对文件](./搭档启动卡.md) · [本机文件 URI](file:///data/workspace/%E6%90%AD%E6%A1%A3%E5%90%AF%E5%8A%A8%E5%8D%A1.md) · [远端文件 URI](file://remote.example/share.md) · [越界文件](/etc/hosts) · [外部网站](https://example.com) · [未知资源](nextclaw://unknown/example) · [失效文件](nextclaw://objects/file/deleted) · [任务引用](nextclaw://objects/task/task-a) · [日程引用](nextclaw://objects/event/event-a) · [送达引用](nextclaw://objects/inbox-delivery/outside-inbox) · [危险](javascript:alert(1))";
let artifact = { id: "artifact-a", path: "report.html", kind: "artifact", uri: "nextclaw://objects/file/artifact-a", content: "<h1>成果预览</h1><p>图表方案</p>", version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const starter = { id: "starter", path: "搭档启动卡.md", kind: "artifact", uri: "nextclaw://objects/file/starter", content: "# 搭档启动卡\n\n这是一份已保存的文档。[文内同一文件](./搭档启动卡.md)", version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

async function fixtures(page: Page) {
  let delivery = { id: "outside-inbox", kind: "decision", title: "列表以外的送达", body: "来自资源引用：[收件箱里的启动卡](/data/workspace/搭档启动卡.md)", source: { kind: "bibo" }, version: 1, readAt: null as string | null, resolvedAt: null as string | null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await mockApi(page);
  await page.route("**/api/history*", (route) => route.fulfill({ json: { messages: [{ role: "user", text: "我的文件：[我的启动卡](/data/workspace/搭档启动卡.md)", at: new Date().toISOString() }, { role: "assistant", text: reply, at: new Date().toISOString() }] } }));
  await page.route("**/api/space", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "inbox.get" && body.input.id === delivery.id) return route.fulfill({ json: { result: delivery } });
    if (["inbox.read", "inbox.resolve"].includes(body.action) && body.input.id === delivery.id) {
      assert.equal(body.input.version, delivery.version);
      delivery = { ...delivery, readAt: new Date().toISOString(), resolvedAt: body.action === "inbox.resolve" ? new Date().toISOString() : null, version: delivery.version + 1 };
      return route.fulfill({ json: { result: delivery } });
    }
    if (body.action === "file.get" && (body.input.id === "artifact-a" || body.input.path === artifact.path)) return route.fulfill({ json: { result: artifact } });
    if (body.action === "file.get" && [starter.path, "/data/workspace/搭档启动卡.md"].includes(body.input.path)) return route.fulfill({ json: { result: starter } });
    if (body.action === "file.get" && body.input.path === "/etc/hosts") return route.fulfill({ status: 400, json: { error: "文件路径不正确。" } });
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

async function verifyMarkdownFileLinks(page: Page, workspace: Locator): Promise<void> {
  const close = page.getByRole("button", { name: "关闭工作区" });
  if (await close.count()) await close.click();
  const absolute = page.getByRole("link", { name: "搭档启动卡.md", exact: true });
  assert.equal(await absolute.getAttribute("href"), `/files?path=${encodeURIComponent("/data/workspace/搭档启动卡.md")}`);
  assert.equal(await absolute.evaluate((node) => getComputedStyle(node).textDecorationLine), "underline");
  for (const name of ["搭档启动卡.md", "相对文件", "本机文件 URI"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await workspace.getByRole("heading", { name: "搭档启动卡", exact: true }).waitFor();
    if (name === "搭档启动卡.md") {
      await workspace.getByRole("link", { name: "文内同一文件", exact: true }).click();
      await workspace.getByRole("heading", { name: "搭档启动卡", exact: true }).waitFor();
    }
    await page.getByRole("button", { name: "关闭工作区" }).click();
  }
  await page.getByRole("link", { name: "我的启动卡", exact: true }).click();
  await workspace.getByRole("heading", { name: "搭档启动卡", exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭工作区" }).click();
  const remote = page.getByRole("link", { name: "远端文件 URI", exact: true });
  assert.equal(await remote.getAttribute("aria-disabled"), "true");
  await page.getByRole("link", { name: "越界文件", exact: true }).click();
  await workspace.getByText("文件路径不正确。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("link", { name: "搭档启动卡.md", exact: true }).click();
  await workspace.getByRole("heading", { name: "搭档启动卡", exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭工作区" }).click();
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
      else assert.equal(await workspace.getByRole("tab", { name: "想法.md", exact: true }).getAttribute("aria-selected"), "true", "slow A never replaces the later B selection");
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
      await page.getByRole("link", { name: "收件箱里的启动卡", exact: true }).click();
      await page.waitForURL("**/files?path=**");
      await page.getByRole("tab", { name: "搭档启动卡.md", exact: true }).waitFor();
    } else await page.getByRole("textbox", { name: path === "/tasks" ? "任务名称" : "标题", exact: true }).waitFor();
  }
}

async function verifyNeutralMarkdown(page: Page, width: number): Promise<void> {
  await page.evaluate(() => localStorage.setItem("bibo-ui-theme", "neutral"));
  await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
  const link = page.getByRole("link", { name: "我的启动卡", exact: true });
  await link.waitFor();
  const colors = await link.evaluate((node) => ({ ink: getComputedStyle(node).color, surface: getComputedStyle(node.closest(".ui-message__body")!).backgroundColor }));
  const luminance = (rgb: string) => rgb.match(/\d+/g)!.slice(0, 3).map(Number).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
  const ink = luminance(colors.ink);
  const surface = luminance(colors.surface);
  const contrast = (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05);
  assert.ok(contrast >= 4.5, `neutral theme user link contrast: ${contrast}`);
  await page.screenshot({ path: `/tmp/bibo-markdown-neutral-${width}.png` });
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
  await verifyMarkdownFileLinks(page, workspace);
  await verifyFailures(page, workspace);
  if (width === 1440) await verifyConcurrency(page, workspace, link);
  await verifyStandalone(page);
  await verifyModules(page);
  await verifyNeutralMarkdown(page, width);
  assert.deepEqual(errors, []);
  await page.close();
  console.log("workspace resources verified", width);
}

async function failNext(page: Page, action: string, error: string, status = 503): Promise<void> {
  let used = false;
  await page.route("**/api/space", (route: Route) => {
    if (used || route.request().postDataJSON().action !== action) return route.fallback();
    used = true;
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error }) });
  });
}
async function quiet(page: Page): Promise<void> {
  assert.equal(await page.locator(".bibo-space-feedback").count(), 0, "no global success toast is mounted");
  assert.equal(await page.locator(".bibo-space-error").count(), 0, "write failures are not duplicated as page read errors");
}

async function checkFeedbackQuickTask(page: Page, width: number): Promise<void> {
  await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
  const input = page.getByRole("textbox", { name: "快速添加任务" });
  await failNext(page, "task.create", "任务保存失败，请重试");
  await input.fill("反馈回归任务"); await input.press("Enter");
  const failure = page.locator(".workspace-page > div").first().getByRole("alert");
  await failure.waitFor();
  assert.match(await failure.innerText(), /任务保存失败/);
  assert.equal(await input.inputValue(), "反馈回归任务");
  await page.waitForTimeout(4200);
  assert.equal(await failure.isVisible(), true, "an actionable error never expires like a toast");
  await quiet(page);
  await page.screenshot({ path: `/tmp/bibo-feedback-task-error-${width}.png`, fullPage: true });
  await input.press("Enter");
  const row = page.locator(".ui-list-row-group").filter({ hasText: "反馈回归任务" });
  await row.waitFor();
  await page.waitForFunction(() => (document.querySelector('[aria-label="快速添加任务"]') as HTMLInputElement)?.value === "");
  assert.equal(await failure.count(), 0);
}

async function checkFeedbackToggle(page: Page): Promise<void> {
  const row = page.locator(".ui-list-row-group").filter({ hasText: "反馈回归任务" });
  await failNext(page, "task.update", "勾选失败，请重试");
  await row.getByRole("button", { name: "完成 反馈回归任务", exact: true }).click();
  await row.getByRole("alert").waitFor();
  assert.match(await row.innerText(), /勾选失败/);
  await row.getByRole("button", { name: "完成 反馈回归任务", exact: true }).click();
  await page.getByRole("button", { name: "撤销操作" }).waitFor();
  await failNext(page, "task.update", "撤销失败，请重试");
  await page.getByRole("button", { name: "撤销操作" }).click();
  await page.getByText("撤销失败，请重试", { exact: true }).waitFor();
  await page.getByRole("button", { name: "撤销操作" }).click();
  await page.getByRole("button", { name: "撤销操作" }).waitFor({ state: "hidden" });
  await quiet(page);
}

async function checkFeedbackProject(page: Page): Promise<void> {
  await page.getByRole("button", { name: "筛选与视图", exact: true }).click();
  await page.getByRole("button", { name: "＋ 项目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新建项目" });
  await dialog.getByRole("textbox", { name: "项目名称" }).fill("反馈回归项目");
  await failNext(page, "project.create", "项目保存失败，请重试");
  await dialog.getByRole("button", { name: "创建", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  await quiet(page);
  await dialog.getByRole("button", { name: "创建", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("combobox", { name: "按项目筛选" }).locator("option").filter({ hasText: "反馈回归项目" }).count(), 1);
}

async function checkFeedbackFilter(page: Page): Promise<void> {
  await page.getByRole("button", { name: "已完成", exact: true }).click();
  await page.getByRole("button", { name: "打开完整新建任务" }).click();
  const taskDialog = page.getByRole("dialog", { name: "新任务", exact: true });
  await taskDialog.getByRole("textbox", { name: "任务名称" }).fill("筛选之外也有反馈");
  await taskDialog.getByRole("button", { name: "保存任务", exact: true }).click();
  await taskDialog.waitFor({ state: "hidden" });
  await page.getByText("已保存「筛选之外也有反馈」，当前筛选下不显示。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "查看任务", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "任务名称" }).inputValue(), "筛选之外也有反馈");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await quiet(page);
}

async function checkFeedbackCalendar(page: Page): Promise<void> {
  await page.goto(`${base}/calendar`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "＋ 新日程", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新日程", exact: true });
  await dialog.getByRole("textbox", { name: "标题", exact: true }).fill("反馈回归日程");
  await failNext(page, "event.create", "日程保存失败，请重试");
  await dialog.getByRole("button", { name: "保存日程", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  await quiet(page);
  await dialog.getByRole("button", { name: "保存日程", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("反馈回归日程", { exact: true }).filter({ visible: true }).first().waitFor();
  await quiet(page);
}

async function checkFeedbackFiles(page: Page, width: number): Promise<void> {
  await page.goto(`${base}/files`, { waitUntil: "networkidle" });
  await page.getByRole("treeitem", { name: "想法.md", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "编辑 想法.md" });
  const surface = page.locator(".bibo-file-editor");
  const save = surface.getByRole("button", { name: "保存", exact: true });
  await editor.fill("保存失败也保留的草稿");
  await failNext(page, "file.update", "文件保存失败，请重试");
  await save.click();
  await surface.getByText("文件保存失败，请重试", { exact: true }).waitFor();
  assert.equal(await editor.inputValue(), "保存失败也保留的草稿");
  await quiet(page);
  await page.screenshot({ path: `/tmp/bibo-feedback-file-error-${width}.png`, fullPage: true });
  await save.click();
  await surface.getByText("文件保存失败，请重试", { exact: true }).waitFor({ state: "hidden" });
  await surface.locator(".bibo-save-state").filter({ hasText: /^已保存$/ }).waitFor();
  await checkFeedbackDuringSave(page);
  await checkFeedbackConflict(page);
  await quiet(page);
  await page.screenshot({ path: `/tmp/bibo-feedback-file-saved-${width}.png`, fullPage: true });
}

async function checkFeedbackInbox(page: Page): Promise<void> {
  await page.goto(`${base}/inbox`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /确认方案方向/ }).click();
  const pane = page.locator(".bibo-detail-pane");
  await failNext(page, "inbox.read", "标记已读失败，请重试");
  await pane.getByRole("button", { name: "标记已读", exact: true }).click();
  await pane.getByText("标记已读失败，请重试", { exact: true }).waitFor();
  await quiet(page);
  await pane.getByRole("button", { name: "标记已读", exact: true }).click();
  await pane.getByRole("button", { name: "标记已读", exact: true }).waitFor({ state: "hidden" });
  await failNext(page, "inbox.resolve", "处理失败，请重试");
  await pane.getByRole("button", { name: "已处理", exact: true }).click();
  await pane.getByText("处理失败，请重试", { exact: true }).waitFor();
  await pane.getByRole("button", { name: "已处理", exact: true }).click();
  await pane.getByRole("button", { name: "已处理", exact: true }).waitFor({ state: "hidden" });
  await pane.getByText(/^已处理 · /).waitFor();
  await quiet(page);
}

async function checkFeedbackDuringSave(page: Page): Promise<void> {
  const editor = page.getByRole("textbox", { name: "编辑 想法.md" });
  const surface = page.locator(".bibo-file-editor");
  const save = surface.getByRole("button", { name: "保存", exact: true });
  let delayed = false;
  await page.route("**/api/space", async (route) => {
    if (delayed || route.request().postDataJSON().action !== "file.update") return route.fallback();
    delayed = true; await new Promise((resolve) => setTimeout(resolve, 400)); await route.fallback();
  });
  await editor.fill("这部分正在保存"); await save.click();
  await surface.locator(".bibo-save-state").filter({ hasText: /^保存中/ }).waitFor();
  await editor.fill("保存中继续输入的新内容");
  await surface.locator(".bibo-save-state").filter({ hasText: /^未保存$/ }).waitFor();
  assert.equal(await editor.inputValue(), "保存中继续输入的新内容");
  await save.click();
  await surface.locator(".bibo-save-state").filter({ hasText: /^已保存$/ }).waitFor();
}

async function checkFeedbackConflict(page: Page): Promise<void> {
  const editor = page.getByRole("textbox", { name: "编辑 想法.md" });
  const surface = page.locator(".bibo-file-editor");
  const save = surface.getByRole("button", { name: "保存", exact: true });
  await editor.fill("冲突时保留我的草稿");
  await failNext(page, "file.update", "版本冲突", 409); await save.click();
  await surface.getByText("文件已在别处更新。你的修改仍保留在这里。", { exact: true }).waitFor();
  assert.equal(await editor.inputValue(), "冲突时保留我的草稿");
  await surface.getByRole("button", { name: "用当前草稿覆盖", exact: true }).click();
  await page.getByRole("dialog", { name: "覆盖服务器内容？" }).getByRole("button", { name: "确认覆盖", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await surface.locator(".bibo-save-state").filter({ hasText: /^已保存$/ }).waitFor();
}

async function verifyFeedback(browser: Browser, width: number): Promise<void> {
  const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 600 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await mockApi(page);
    await checkFeedbackQuickTask(page, width);
    await checkFeedbackToggle(page);
    await checkFeedbackProject(page);
    await checkFeedbackFilter(page);
    await checkFeedbackCalendar(page);
    await checkFeedbackFiles(page, width);
    await checkFeedbackInbox(page);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    console.log("workspace feedback verified", width);
  } catch (error) {
    await page.screenshot({ path: `/tmp/bibo-feedback-failed-${width}.png`, fullPage: true });
    throw error;
  } finally { await page.close(); }
}

async function main() {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390, 320]) { await verifyWidth(browser, width); await verifyFeedback(browser, width); }
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
});
