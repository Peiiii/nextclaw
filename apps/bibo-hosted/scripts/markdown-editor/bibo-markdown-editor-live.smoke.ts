import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

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
page.on("dialog", (dialog) => dialog.accept());
const path = `markdown-editor-smoke-${crypto.randomUUID().slice(0, 8)}.md`;
type File = { id: string; path: string; version: number; content: string };
async function space<T>(action: string, input: Record<string, unknown>): Promise<T> {
  return page.evaluate(async ({ action, input }) => {
    const response = await fetch("/api/space", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, input }) });
    if (!response.ok) throw new Error(`${action}: ${response.status}`);
    return (await response.json()).result;
  }, { action, input });
}
let created = false;
try {
  await page.goto(`${origin}/notes`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新笔记", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新笔记", exact: true });
  await dialog.getByRole("textbox", { name: "文件名称" }).fill(path);
  await dialog.getByRole("button", { name: "创建", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  created = true;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const text = `# Markdown 上线验收 ${width}\n\n这是 **真实保存** 的中文文档。\n\n- 默认预览\n- 编辑与高亮源码\n\n\`\`\`typescript\nconst saved = true;\n\`\`\``;
    await page.getByRole("group", { name: "文件模式" }).getByRole("button", { name: "源码", exact: true }).click();
    const editor = page.getByRole("textbox", { name: `编辑 ${path}` });
    await editor.fill(text);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.locator(".bibo-file-editor-status").getByText("已保存", { exact: true }).waitFor();
    const saved = await space<File>("file.get", { path });
    assert.equal(saved.content, text, "real server persisted exactly the Markdown text");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: `Markdown 上线验收 ${width}` }).waitFor();
    assert.equal(await page.getByRole("group", { name: "文件模式" }).getByRole("button", { name: "预览", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    await page.locator(".cm-md-heading").waitFor();
    await page.screenshot({ path: `/tmp/bibo-markdown-editor-live-${width}.png` });
    console.log(`Production ${width}px: UI creation, editing, exact persisted Markdown and refreshed preview passed`);
  }
} finally {
  if (created) {
    const file = await space<File>("file.get", { path });
    await space("file.delete", { id: file.id, version: file.version });
    console.log("Removed only this run's test note");
  }
  await browser.close();
}
