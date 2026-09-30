import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, type Page } from "playwright";
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
page.setDefaultTimeout(20000);
const dialogs: string[] = [];
page.on("dialog", (dialog) => { dialogs.push(dialog.type()); void dialog.accept(); });
const path = `markdown-editor-smoke-${crypto.randomUUID().slice(0, 8)}.md`;
type File = { id: string; path: string; version: number; content: string };
async function space<T>(action: string, input: Record<string, unknown>): Promise<T> {
  return page.evaluate(async ({ action, input }) => {
    const response = await fetch("/api/space", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, input }) });
    if (!response.ok) throw new Error(`${action}: ${response.status} ${await response.text()}`);
    return (await response.json()).result;
  }, { action, input });
}
let createdId: string | undefined;
async function checkLiveImage(page: Page) {
  await page.getByRole("button", { name: "更多格式", exact: true }).click();
  await page.getByRole("menuitem", { name: "图片", exact: true }).click();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
  await page.getByRole("dialog", { name: "图片", exact: true }).locator("input[type=file]").setInputFiles({ name: "deployment-test.png", mimeType: "image/png", buffer: png });
  const image = page.locator(".tiptap:visible img[src^='/api/assets/']");
  await image.waitFor();
  const src = await image.getAttribute("src");
  assert.ok(src);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".bibo-file-editor-status").getByText("已保存", { exact: true }).waitFor();
  assert.ok((await space<File>("file.get", { path })).content.includes(src));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(`.tiptap img[src='${src}']`).waitFor();
  await page.waitForFunction(source => { const image = document.querySelector(`img[src='${source}']`) as HTMLImageElement; return image?.complete && image.naturalWidth === 1; }, src);
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(origin + src)).status(), 401, "private assets require authentication");
  await anonymous.close();
  assert.equal((await context.request.post(origin + "/api/assets", { headers: { origin: "https://example.com" }, data: png })).status(), 403, "cross-site uploads are rejected before storage");
  console.log("Production private image: real upload, save, reload, authenticated display and access checks passed");
}
try {
  await page.goto(`${origin}/notes`, { waitUntil: "networkidle" });
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
    const text = `# Markdown 上线验收 ${width}\n\n这是 **真实保存** 的中文文档。\n\n- 默认预览\n- 编辑与高亮源码\n\n\`\`\`typescript\nconst saved = true;\n\`\`\``;
    await openMarkdownSource(page);
    const editor = page.locator(".cm-content:visible");
    await editor.click(); await page.keyboard.press("ControlOrMeta+a"); await page.keyboard.insertText(text);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.locator(".bibo-file-editor-status").getByText("已保存", { exact: true }).waitFor();
    const saved = await space<File>("file.get", { path });
    assert.equal(saved.content, text, "real server persisted exactly the Markdown text");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: `Markdown 上线验收 ${width}` }).waitFor();
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }), false, "a restored code-ending document is not an unsaved edit");
    await page.locator(".tiptap:visible").getByRole("heading", { name: `Markdown 上线验收 ${width}` }).waitFor();
    await page.locator(".tiptap:visible h1").waitFor();
    await page.locator(".tiptap:visible h1").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("正文编辑真实保存");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".tiptap:visible").getByText(/正文编辑真实保存/).waitFor();
    assert.deepEqual(dialogs, [], "dirty document refresh has no browser confirmation");
    assert.ok(!(await space<File>("file.get", { id: createdId })).content.includes("正文编辑真实保存"), "refresh restores the local draft before server save");
    await page.locator(".tiptap:visible").getByText(/正文编辑真实保存/).click();
    await page.keyboard.press("ControlOrMeta+s");
    await page.locator(".bibo-file-editor-status").getByText("已保存", { exact: true }).waitFor();
    assert.ok((await space<File>("file.get", { path })).content.includes("正文编辑真实保存"));
    if (width === 1440) await checkLiveImage(page);
    await page.screenshot({ path: `/tmp/bibo-markdown-editor-live-${width}.png` });
    console.log(`Production ${width}px: UI creation, editing, exact persisted Markdown and refreshed preview passed`);
  }
} catch (error) {
  await page.screenshot({ path: "/tmp/bibo-production-failure.png" }).catch(() => undefined);
  throw error;
} finally {
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
  await browser.close();
}
