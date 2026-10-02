import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";
import { mockApi, openMarkdownSource } from "../personal-workspace.fixture";

const port = String(30000 + process.pid % 20000);
const base = process.env.BIBO_SMOKE_BASE ?? `http://127.0.0.1:${port}`;
const server = process.env.BIBO_SMOKE_BASE ? null : spawn(process.execPath, [new URL("../../node_modules/vite/bin/vite.js", import.meta.url).pathname, "preview", "--host", "127.0.0.1", "--port", port, "--strictPort"], { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
const browser = await chromium.launch({ headless: true });
const file = "file-a";
async function read(page: Page, id = file) {
  return page.evaluate(async id => (await (await fetch("/api/space", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "file.get", input: { id } }) })).json()).result, id);
}
async function replace(page: Page, text: string) {
  await openMarkdownSource(page);
  await page.locator(".cm-content:visible").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
}
async function checkSave(page: Page, view: "notes" | "files", width: number) {
  await page.goto(`${base}/${view}/${file}`);
  await page.locator(".tiptap:visible h1").waitFor();
  const status = page.locator(".bibo-file-editor-status");
  const statusHeight = (await status.boundingBox())!.height;
  const text = `# 自动保存 ${width}\n\n不用寻找保存按钮。`;
  await replace(page, text);
  assert.equal((await status.boundingBox())!.height, statusHeight, "showing the save action does not change the editor height");
  await page.getByTitle("已保存 · v2").waitFor();
  assert.equal((await status.boundingBox())!.height, statusHeight, "save acknowledgement keeps the same feedback area");
  assert.equal((await read(page)).content, text, "source persists without a save action");
  await page.reload();
  await page.locator(".tiptap:visible h1").click();
  await page.keyboard.press("End"); await page.keyboard.insertText(" · 正文编辑");
  await page.getByTitle("已保存 · v3").waitFor();
  assert.ok((await read(page)).content.includes("正文编辑"));
  await page.screenshot({ path: `/tmp/bibo-editing-saved-${view}-${width}.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
async function checkRecovery(page: Page) {
  let fail = true, writes = 0;
  await page.route("**/api/space", async route => {
    if (route.request().postDataJSON().action === "file.update") {
      writes++;
      if (fail) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "测试保存失败" }) });
    }
    await route.fallback();
  });
  await page.goto(`${base}/notes/${file}`);
  await replace(page, "# 保留失败草稿\n\n手机可以重试。");
  const retry = page.getByRole("button", { name: "重试保存", exact: true });
  await retry.waitFor();
  assert.ok((await retry.boundingBox())!.height >= 44, "touch retry has a usable target");
  await page.reload();
  await page.locator(".tiptap:visible h1").getByText("保留失败草稿", { exact: true }).waitFor();
  await retry.waitFor();
  await page.screenshot({ path: "/tmp/bibo-editing-retry-390.png" });
  assert.ok(!(await read(page)).content.includes("保留失败草稿"), "failed draft is not misreported as a server save");
  fail = false; await retry.click();
  await page.getByTitle("已保存 · v2").waitFor();
  assert.ok((await read(page)).content.includes("保留失败草稿"));
  await openMarkdownSource(page);
  await page.locator(".cm-content:visible").waitFor();
  await page.context().setOffline(true);
  await replace(page, "# 断网草稿\n\n联网后自动保存。");
  await page.getByText("离线 · 草稿已保留，联网后自动保存", { exact: true }).waitFor();
  const before = writes; await page.waitForTimeout(1200);
  assert.equal(writes, before, "offline editing does not attempt a server write");
  await page.context().setOffline(false);
  await page.getByTitle("已保存 · v3").waitFor();
  assert.ok((await read(page)).content.includes("断网草稿"));
}
async function geometry(page: Page) {
  return page.locator(".ui-popover").evaluate(element => ({ height: element.clientHeight, width: element.clientWidth, top: Math.round(element.getBoundingClientRect().top) }));
}
async function checkPlainFile(page: Page) {
  await page.goto(`${base}/files/navigation-4`);
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.locator(".cm-content:visible").waitFor();
  await replace(page, "纯文本文件自动保存");
  await page.getByTitle("已保存 · v2").waitFor();
  assert.equal((await read(page, "navigation-4")).content, "纯文本文件自动保存");
}
async function checkWorkspace(page: Page) {
  await page.route("**/api/history?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [{ role: "assistant", text: "[编辑笔记](nextclaw://objects/file/file-a)", at: new Date().toISOString() }] }) }));
  await page.goto(`${base}/chat/session-a`);
  await page.getByRole("link", { name: "编辑笔记", exact: true }).click();
  const workspace = page.getByRole("complementary", { name: "右侧工作区" });
  await workspace.locator(".tiptap:visible").waitFor();
  await replace(page, "# 工作区自动保存");
  await workspace.getByTitle("已保存 · v2").waitFor();
  assert.equal((await read(page)).content, "# 工作区自动保存");
}
async function checkDirectory(page: Page, width: number) {
  await page.goto(`${base}/files/${file}`);
  await page.locator(".file-breadcrumb button").first().waitFor();
  let release!: () => void, fail = false, calls = 0;
  let gate = Promise.resolve();
  await page.route("**/api/space", async route => {
    const body = route.request().postDataJSON();
    if (body.action !== "file.list" || body.input.parentPath === undefined) return route.fallback();
    calls++; await gate;
    if (fail) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "测试目录失败" }) });
    await route.fallback();
  });
  for (const refresh of [false, true]) {
    gate = new Promise<void>(resolve => { release = resolve; });
    await page.locator(".file-breadcrumb button").first().click();
    await page.locator(".file-directory-location [role=status][aria-label]").waitFor();
    await page.waitForTimeout(200);
    const pending = await geometry(page);
    if (refresh) assert.equal(await page.locator(".file-directory-entry").count() > 0, true, "cached entries remain readable while refreshing");
    release();
    await page.locator('.file-directory-contents[aria-busy="false"]').waitFor();
    assert.deepEqual(await geometry(page), pending, "loading does not resize or reposition the menu");
    await page.getByRole("button", { name: "A-empty", exact: true }).click();
    await page.getByText("文件夹为空", { exact: true }).waitFor();
    assert.deepEqual(await geometry(page), pending, "empty directories share the same reading area");
    await page.getByRole("button", { name: "返回上级目录", exact: true }).click();
    await page.getByRole("button", { name: "A-empty", exact: true }).waitFor();
    await page.screenshot({ path: `/tmp/bibo-directory-stable-${width}.png` });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement === document.querySelector(".file-breadcrumb button"));
  }
  fail = true; gate = Promise.resolve();
  await checkDirectoryFailure(page, () => { fail = false; });
  await checkDirectoryPagination(page);
  assert.ok(calls >= 5);
}
async function checkDirectoryPagination(page: Page) {
  await page.keyboard.press("Escape");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/space", async route => {
    const body = route.request().postDataJSON();
    if (body.action !== "file.list" || body.input.parentPath !== "") return route.fallback();
    if (body.input.cursor) await gate;
    const path = body.input.cursor ? "第二页.md" : "第一页.md";
    await route.fulfill({ json: { result: { items: [{ id: path, path, kind: "file", version: 1 }], nextCursor: body.input.cursor ? undefined : "next" } } });
  });
  await page.locator(".file-breadcrumb button").first().click();
  const menu = page.locator(".ui-popover");
  await menu.getByRole("button", { name: "第一页.md", exact: true }).waitFor();
  const ready = await geometry(page);
  await menu.getByRole("button", { name: "加载更多文件", exact: true }).click();
  await page.locator('.file-directory-contents[aria-busy="true"]').waitFor();
  assert.equal(await menu.getByRole("button", { name: "第一页.md", exact: true }).count(), 1);
  assert.deepEqual(await geometry(page), ready, "loading the next page keeps cached entries and menu geometry");
  release();
  await menu.getByRole("button", { name: "第二页.md", exact: true }).waitFor();
  assert.deepEqual(await geometry(page), ready, "additional entries scroll inside the same menu");
}
async function checkDirectoryFailure(page: Page, recover: () => void) {
  await page.locator(".file-breadcrumb button").first().click();
  await page.locator(".ui-popover").getByText("测试目录失败", { exact: true }).waitFor();
  const failed = await geometry(page);
  recover(); await page.locator(".ui-popover").getByRole("button", { name: "重试读取目录", exact: true }).click();
  await page.locator('.file-directory-contents[aria-busy="false"]').waitFor();
  assert.deepEqual(await geometry(page), failed, "retry does not resize the menu");
}
async function ready() {
  if (!server) return;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Isolated editing preview exited");
    try { if ((await fetch(base)).ok) return; } catch { /* Preview is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Isolated editing preview did not start");
}
try {
  await ready();
  for (const width of [1440, 390, 320]) {
    for (const view of ["notes", "files"] as const) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 760, reducedMotion: "reduce" });
      await mockApi(page, false, true);
      await checkSave(page, view, width);
      if (view === "files") await checkDirectory(page, width);
      if (view === "files" && width === 320) await checkPlainFile(page);
      await page.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
  await mockApi(page); await checkRecovery(page); await page.close();
  const workspace = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
  await mockApi(workspace); await checkWorkspace(workspace); await workspace.close();
  console.log("Desktop/390/320 note and file autosave, draft recovery, reconnect and stable directory menus passed");
} finally { await browser.close(); server?.kill("SIGTERM"); }
