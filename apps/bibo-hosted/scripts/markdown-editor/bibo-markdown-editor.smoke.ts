import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";
import { mockApi } from "../personal-workspace.fixture";

const port = String(30000 + process.pid % 20000);
const base = process.env.BIBO_SMOKE_BASE ?? `http://127.0.0.1:${port}`;
const server = process.env.BIBO_SMOKE_BASE ? null : spawn(process.execPath, [new URL("../../node_modules/vite/bin/vite.js", import.meta.url).pathname, "--host", "127.0.0.1", "--port", port, "--strictPort"], { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
const documentText = "# 写作体验\n\n这是 **重要内容**，也有 *斜体*。\n\n## 下一步\n\n- 第一项\n- 第二项\n\n```typescript\nconst greeting = \"你好\";\nconsole.log(greeting);\n```\n\n保留公式 $E=mc^2$ 与 [链接](https://example.com)。";
const mode = (page: Page, name: string) => page.getByRole("group", { name: "文件模式" }).getByRole("button", { name, exact: true });
const editorFor = (page: Page) => page.getByRole("textbox", { name: "编辑 想法.md" });
const contentOf = (page: Page) => editorFor(page).locator(".cm-line").allTextContents().then((lines) => lines.join("\n"));

async function checkEditor(page: Page, width: number) {
  page.setDefaultTimeout(12000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await mockApi(page);
  await page.goto(`${base}/files/file-a`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "一个想法" }).waitFor();
  assert.equal(await mode(page, "预览").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".cm-editor").count(), 0, "reader does not mount an editor until needed");
  await checkWriting(page);
  await checkHistoryAndSearch(page);
  await checkDraftRecovery(page);
  await checkConflicts(page);
  await checkTypingDuringSave(page);
  await checkLayout(page, width);
  assert.deepEqual(errors, []);
  console.log(`Markdown editor ${width}px: preview, live/source, IME, history, search, draft recovery, conflicts and concurrent saves passed`);
}

async function checkWriting(page: Page) {
  await mode(page, "编辑").click();
  const editor = editorFor(page);
  await editor.fill(documentText);
  await editor.press("ControlOrMeta+End");
  await page.locator(".cm-md-h1").waitFor();
  assert.equal(await page.locator(".cm-md-strong").first().evaluate((element) => getComputedStyle(element).fontWeight), "700");
  const identity = await editor.elementHandle();
  await mode(page, "源码").click();
  assert.equal(await editor.evaluate((element, original) => element === original, identity), true);
  await page.locator(".cm-syntax-keyword").first().waitFor();
  assert.equal(await contentOf(page), documentText);
  await editor.press("ControlOrMeta+End");
  await editor.press("Enter");
  const ime = await page.context().newCDPSession(page);
  await ime.send("Input.imeSetComposition", { text: "中文输入", selectionStart: 4, selectionEnd: 4 });
  await ime.send("Input.insertText", { text: "中文输入不会丢失" });
  await ime.detach();
  assert.equal(await editor.evaluate((element, original) => element === original, identity), true, "IME keeps the content DOM");
  await mode(page, "预览").click();
  await page.getByRole("heading", { name: "写作体验" }).waitFor();
  await mode(page, "源码").click();
  assert.equal(await editor.evaluate((element, original) => element === original, identity), true);
}

async function checkHistoryAndSearch(page: Page) {
  const editor = editorFor(page);
  await editor.press("ControlOrMeta+z");
  assert.ok(!(await contentOf(page)).includes("中文输入不会丢失"), "undo survives preview switches");
  await editor.press("ControlOrMeta+Shift+z");
  assert.ok((await contentOf(page)).includes("中文输入不会丢失"));
  await page.getByRole("button", { name: /查找与替换/ }).click();
  const search = page.locator(".cm-search input[name=search]");
  await search.fill("中文输入");
  await search.press("Enter");
  await page.locator(".cm-searchMatch").first().waitFor();
  await search.press("Escape");
}

async function checkDraftRecovery(page: Page) {
  const editor = editorFor(page);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByTitle("已保存 · v2").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "写作体验" }).waitFor();
  await mode(page, "编辑").click();
  await editor.fill("- 连续列表");
  await editor.press("ControlOrMeta+End");
  await editor.press("Enter");
  await page.keyboard.insertText("第二项");
  await mode(page, "源码").click();
  assert.equal(await contentOf(page), "- 连续列表\n- 第二项");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("本标签页草稿已备份").waitFor();
  await mode(page, "源码").click();
  assert.equal(await contentOf(page), "- 连续列表\n- 第二项", "reload restores dirty draft");
  let fail = true;
  await page.route("**/api/space", async (route) => {
    if (fail && route.request().postDataJSON().action === "file.update") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "测试保存失败" }) });
    return route.fallback();
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("测试保存失败", { exact: true }).waitFor();
  assert.equal(await contentOf(page), "- 连续列表\n- 第二项");
  fail = false;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByTitle("已保存 · v3").waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("bibo-file-drafts:smoke")), null);
}

async function checkConflicts(page: Page) {
  const editor = editorFor(page);
  await page.evaluate(async () => {
    await fetch("/api/space", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "file.update", input: { id: "file-a", version: 3, content: "# 外部更新" } }) });
  });
  await editor.fill("# 冲突草稿");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("文件已在别处更新。你的修改仍保留在这里。").waitFor();
  assert.equal(await contentOf(page), "# 冲突草稿");
  await page.getByRole("button", { name: "读取最新版本", exact: true }).click();
  await page.getByRole("button", { name: "放弃修改并读取", exact: true }).click();
  await page.getByTitle("已保存 · v4").waitFor();
  assert.equal(await contentOf(page), "# 外部更新", "conflict recovery synchronizes the existing editor");
}

async function checkTypingDuringSave(page: Page) {
  const editor = editorFor(page);
  let releaseSave: (() => void) | undefined;
  let delaying = true;
  await page.route("**/api/space", async (route) => {
    if (delaying && route.request().postDataJSON().action === "file.update") {
      delaying = false;
      await new Promise<void>((resolve) => { releaseSave = resolve; });
    }
    return route.fallback();
  });
  await editor.fill("# 提交的版本");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "保存中…", exact: true }).waitFor();
  await editor.fill("# 保存期间继续修改");
  assert.ok(releaseSave);
  releaseSave();
  await page.getByRole("button", { name: "保存", exact: true }).waitFor();
  assert.equal(await contentOf(page), "# 保存期间继续修改", "save responses cannot replace newer typing");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByTitle("已保存 · v6").waitFor();
}

async function checkLayout(page: Page, width: number) {
  const editor = editorFor(page);
  await editor.fill(documentText);
  await mode(page, "编辑").click();
  await editor.press("ControlOrMeta+End");
  await page.screenshot({ path: `/tmp/bibo-markdown-editor-${width}.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "no page overflow");
  const controls = await page.locator(".file-editor-tools button, .ui-markdown-editor-toolbar button:visible").evaluateAll((buttons) => buttons.every((button) => {
    const box = button.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth;
  }));
  assert.equal(controls, true, "mode and save controls fit narrow screens");
}

try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base)).ok) break; } catch { /* The isolated server is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 });
      try { await checkEditor(page, width); }
      catch (error) { await page.screenshot({ path: "/tmp/bibo-markdown-editor-failure.png" }); console.error(await page.locator("body").innerText()); throw error; }
      finally { await page.close(); }
    }
  } finally { await browser.close(); }
} finally { server?.kill("SIGTERM"); }
