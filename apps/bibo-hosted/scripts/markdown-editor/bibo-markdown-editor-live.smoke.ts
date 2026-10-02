import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, type Page, type Route } from "playwright";
import { openMarkdownSource } from "../personal-workspace.fixture";

const origin = "https://app.bibo.bot";
const accountFile = process.env.BIBO_SMOKE_ACCOUNT_FILE ?? join(homedir(), ".config/bibo-hosted/smoke-account.json");
assert.equal(statSync(accountFile).mode & 0o077, 0, "The test account file must be private");
const account = JSON.parse(readFileSync(accountFile, "utf8")) as { origin: string; email: string; password: string; userId: string };
assert.equal(account.origin, origin);
// Credentials travel only on stdin/in-memory cookie storage, never in process arguments or reports.
const login = spawnSync("curl", ["--silent", "--show-error", "--max-time", "30", "--include", "--header", "content-type: application/json", "--header", `origin: ${origin}`, "--data-binary", "@-", `${origin}/api/auth/login`], {
  input: JSON.stringify({ email: account.email, password: account.password }), encoding: "utf8",
});
assert.equal(login.status, 0, "Test account login transport failed");
const boundary = login.stdout.lastIndexOf("\r\n\r\n");
assert.equal(JSON.parse(login.stdout.slice(boundary + 4)).user?.id, account.userId, "Unexpected test identity");
const token = login.stdout.slice(0, boundary).match(/set-cookie:\s*bibo_session=([^;\r\n]+)/i)?.[1];
assert.ok(token, "No test session cookie");
const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const proxy = proxyUrl ? { server: new URL(proxyUrl).origin } : undefined;
const browser = await chromium.launch({ headless: true, proxy });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([{ name: "bibo_session", value: token, domain: "app.bibo.bot", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const dialogs: string[] = [];
page.on("dialog", (dialog) => { dialogs.push(dialog.type()); void dialog.accept(); });
const folder = `markdown-editor-smoke-${crypto.randomUUID().slice(0, 8)}`;
const path = `${folder}/功能演示 - 起步.md`;
type File = { id: string; path: string; version: number; content: string; uri: string };
async function space<T>(action: string, input: Record<string, unknown>): Promise<T> {
  return page.evaluate(async ({ action, input }) => {
    const response = await fetch("/api/space", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, input }) });
    if (!response.ok) throw new Error(`${action}: ${response.status} ${await response.text()}`);
    return (await response.json()).result;
  }, { action, input });
}
let createdId: string | undefined;
let createdFolder: { id: string; version: number } | undefined;
let createdSessionId: string | undefined;
async function checkLiveResourceOpening() {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/chat`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: /告诉 Bibo/ }).fill(`请只回复「收到」，不要调用工具。\n\n[验证笔记](${(await space<File>("file.get", { id: createdId })).uri})`);
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/chat"),
    page.getByRole("button", { name: "发送消息", exact: true }).click(),
  ]);
  await page.waitForURL(/\/chat\/[^/]+$/);
  createdSessionId = new URL(page.url()).pathname.split("/").at(-1);
  assert.equal(response.status(), 200, "Production chat accepted the test message");
  await page.waitForFunction(async sessionId => {
    const response = await fetch(`/api/runs?sessionId=${encodeURIComponent(sessionId!)}`);
    if (!response.ok) throw new Error(`Test run state: ${response.status}`);
    const state = await response.json();
    if (state.run?.phase === "failed") throw new Error(`Test run failed: ${state.run.error?.code}`);
    return state.run?.sessionId === sessionId && state.run.phase === "completed";
  }, createdSessionId, { timeout: 60_000, polling: 1000 });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    const workspace = page.getByRole("complementary", { name: "右侧工作区" });
    if (await workspace.isVisible()) await page.getByRole("button", { name: "关闭工作区" }).click();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const hold = async (route: Route) => {
      const input = route.request().postDataJSON();
      if (input.action === "file.get" && input.input.id === createdId) await gate;
      await route.continue();
    };
    await page.route("**/api/space", hold);
    try {
      await page.getByRole("link", { name: "验证笔记", exact: true }).click();
      await workspace.getByRole("status", { name: "正在打开资源" }).waitFor();
      assert.equal(await workspace.getByRole("tablist").count(), 0);
      release();
      await workspace.getByRole("button", { name: `文档 ${path}`, exact: true }).waitFor();
      await workspace.locator(".tiptap:visible").getByText(/正文编辑真实保存/).waitFor();
      await checkLiveTaskHandle();
      await page.screenshot({ path: `/tmp/bibo-document-opening-live-${width}.png` });
      await page.getByRole("button", { name: "关闭工作区" }).click();
    } finally { release(); await page.unroute("**/api/space", hold); }
  }
  console.log("Production resource opening: real conversation link, delayed reads, single-document header and saved content passed at 1440/390px");
}
async function checkLiveTaskHandle() {
  const rich = page.locator(".tiptap:visible");
  await rich.locator('li[data-type=taskItem] p').first().hover();
  await rich.locator('li[data-type=taskItem] input').first().evaluate((input: HTMLInputElement) => input.click());
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.locator(".ui-markdown-block-handle:visible").waitFor();
  const geometry = await rich.locator('ul[data-type=taskList]').evaluate(element => ({
    edge: element.getBoundingClientRect().left,
    right: document.querySelector('.ui-markdown-block-handle button[aria-label="块操作"]')!.getBoundingClientRect().right,
  }));
  assert.ok(geometry.right <= geometry.edge, "production whole-list handle stays outside checkboxes");
  await page.locator(".bibo-file-editor-status").getByText("已保存", { exact: true }).waitFor();
}
async function checkLiveImage(page: Page) {
  await page.getByRole("button", { name: "更多格式", exact: true }).click();
  await page.getByRole("menuitem", { name: "图片", exact: true }).click();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
  await page.getByRole("dialog", { name: "图片", exact: true }).locator("input[type=file]").setInputFiles({ name: "deployment-test.png", mimeType: "image/png", buffer: png });
  const image = page.locator(".tiptap:visible img[src^='/api/assets/']");
  await image.waitFor();
  const src = await image.getAttribute("src");
  assert.ok(src);
  await page.locator(".bibo-file-editor-status").getByText("已保存", { exact: true }).waitFor();
  assert.ok((await space<File>("file.get", { path })).content.includes(src));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(`.tiptap img[src='${src}']`).waitFor();
  await page.waitForFunction(source => { const image = document.querySelector(`img[src='${source}']`) as HTMLImageElement; return image?.complete && image.naturalWidth === 1; }, src);
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(origin + src, { timeout: 60_000 })).status(), 401, "private assets require authentication");
  await anonymous.close();
  assert.equal((await context.request.post(origin + "/api/assets", { headers: { origin: "https://example.com" }, data: png, timeout: 60_000 })).status(), 403, "cross-site uploads are rejected before storage");
  console.log("Production private image: real upload, save, reload, authenticated display and access checks passed");
}
async function checkLiveDraftRecovery() {
  let fail = true;
  const hold = async (route: Route) => {
    const input = route.request().postDataJSON();
    if (fail && input.action === "file.update" && input.input.id === createdId) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "验收模拟保存失败" }) });
    } else await route.continue();
  };
  await page.route("**/api/space", hold);
  try {
    await page.locator(".tiptap:visible h1").click();
    await page.keyboard.press("End"); await page.keyboard.press("Enter");
    await page.keyboard.insertText("正文编辑真实保存");
    await page.getByRole("button", { name: "重试保存", exact: true }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".tiptap:visible").getByText(/正文编辑真实保存/).waitFor();
    await page.getByRole("button", { name: "重试保存", exact: true }).waitFor();
    assert.deepEqual(dialogs, [], "failed draft refresh has no browser confirmation");
    assert.ok(!(await space<File>("file.get", { id: createdId })).content.includes("正文编辑真实保存"), "failed writes are only local drafts");
    fail = false;
    await page.getByRole("button", { name: "重试保存", exact: true }).click();
    await page.locator(".bibo-file-editor-status").getByText("已保存", { exact: true }).waitFor();
    assert.ok((await space<File>("file.get", { path })).content.includes("正文编辑真实保存"));
  } finally { await page.unroute("**/api/space", hold); }
}
try {
  await page.goto(`${origin}/notes`, { waitUntil: "domcontentloaded" });
  createdFolder = await space("file.create", { path: folder, kind: "folder" });
  await page.getByRole("complementary", { name: "全部笔记", exact: true }).getByRole("button", { name: "新笔记", exact: true }).click();
  await page.locator(".tiptap:visible h1").waitFor();
  const createdPath = (await page.getByRole("button", { name: /^文档 / }).getAttribute("aria-label"))!.slice("文档 ".length);
  createdId = (await space<File>("file.get", { path: createdPath })).id;
  console.log("Production test note:", createdId, path);
  await page.getByRole("button", { name: /^文档 / }).click();
  await page.getByRole("menuitem", { name: "移动 / 重命名", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "移动 / 重命名", exact: true });
  await dialog.getByRole("textbox", { name: "文件新路径" }).fill(path);
  await dialog.getByRole("button", { name: "确认移动", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  createdId = (await space<File>("file.get", { path })).id;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const text = `# Markdown 上线验收 ${width}\n\n这是 **真实保存** 的中文文档。\n\n- 默认预览\n- 编辑与高亮源码\n\n- [ ] 创建笔记\n- [x] 保存笔记\n\n\`\`\`typescript\nconst saved = true;\n\`\`\``;
    await openMarkdownSource(page);
    const editor = page.locator(".cm-content:visible");
    await editor.click(); await page.keyboard.press("ControlOrMeta+a"); await page.keyboard.insertText(text);
    await page.locator(".bibo-file-editor-status").getByText("已保存", { exact: true }).waitFor();
    const saved = await space<File>("file.get", { path });
    assert.equal(saved.content, text, "real server persisted exactly the Markdown text");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: `Markdown 上线验收 ${width}` }).waitFor();
    assert.equal(new URL(page.url()).pathname, `/notes/${path.split("/").map(encodeURIComponent).join("/")}`, "nested notes retain their canonical detail route after refresh");
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }), false, "a restored code-ending document is not an unsaved edit");
    await page.locator(".tiptap:visible").getByRole("heading", { name: `Markdown 上线验收 ${width}` }).waitFor();
    await page.locator(".tiptap:visible h1").waitFor();
    await checkLiveDraftRecovery();
    if (width === 1440) await checkLiveImage(page);
    await page.screenshot({ path: `/tmp/bibo-markdown-editor-live-${width}.png` });
    console.log(`Production ${width}px: UI creation, editing, exact persisted Markdown and refreshed preview passed`);
  }
  await checkLiveResourceOpening();
} catch (error) {
  await page.screenshot({ path: "/tmp/bibo-production-failure.png" }).catch(() => undefined);
  throw error;
} finally {
  if (createdSessionId) {
    await page.evaluate(async id => {
      const response = await fetch("/api/sessions/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error(`Test conversation cleanup: ${response.status}`);
    }, createdSessionId).catch(error => { console.error("Test conversation cleanup failed:", error); process.exitCode = 1; });
  }
  if (createdId) {
    try {
      const file = await space<File>("file.get", { id: createdId });
      await space("file.delete", { id: file.id, version: file.version });
      console.log("Removed only this run's test note");
    } catch (error) {
      console.error("Test note cleanup failed:", createdId, error);
      process.exitCode = 1;
    }
  }
  if (createdFolder) {
    try {
      const current = await space<{ id: string; version: number }>("file.get", { id: createdFolder.id });
      await space("file.delete", { id: current.id, version: current.version });
      console.log("Removed only this run's test folder");
    } catch (error) { console.error("Test folder cleanup failed:", error); process.exitCode = 1; }
  }
  await browser.close();
}
