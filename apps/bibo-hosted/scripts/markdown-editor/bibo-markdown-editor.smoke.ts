import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";
import { checkBlockInteractions } from "./markdown-block-interactions.smoke";
import { checkNotionInteractions } from "./markdown-notion-interactions.smoke";
import { checkImageUploads } from "./markdown-image-interactions.smoke";
import { checkDocumentStructure } from "./markdown-structure-interactions.smoke";
import { mockApi } from "../personal-workspace.fixture";

const port = String(30000 + process.pid % 20000);
const base = process.env.BIBO_SMOKE_BASE ?? `http://127.0.0.1:${port}`;
const server = process.env.BIBO_SMOKE_BASE ? null : spawn(process.execPath, [new URL("../../node_modules/vite/bin/vite.js", import.meta.url).pathname, "--host", "127.0.0.1", "--port", port, "--strictPort"], { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
const documentText = "# 写作体验\n\n这是 **重要内容**，也有 *斜体*。\n\n## 下一步\n\n- 第一项\n- 第二项\n\n```typescript\nconst greeting = \"你好\";\nconsole.log(greeting);\n```\n\n保留公式 $E=mc^2$ 与 [链接](https://example.com)。";
const mode = (page: Page, name: string) => page.getByRole("group", { name: "文件模式" }).getByRole("button", { name, exact: true });
const editorFor = (page: Page) => page.locator(".cm-content[role=textbox]:visible");
const richFor = (page: Page) => page.locator(".tiptap:visible");
async function replaceSource(page: Page, text: string) {
  await editorFor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
}
async function openSource(page: Page) {
  if (await mode(page, "源码").count()) await mode(page, "源码").click();
  else { await page.getByRole("button", { name: "文件操作", exact: true }).click(); await page.getByRole("menuitem", { name: "源码", exact: true }).click(); }
}
async function contentOf(page: Page) {
  await editorFor(page).locator(".cm-line").first().waitFor({ state: "attached" });
  return editorFor(page).locator(".cm-line").allTextContents().then((lines) => lines.join("\n"));
}

async function checkEditor(page: Page, width: number) {
  page.setDefaultTimeout(12000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await mockApi(page);
  await page.route("https://example.com/*.png", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="green"/></svg>' }));
  await page.goto(`${base}/files/file-a`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "一个想法" }).waitFor();
  assert.equal(await mode(page, "预览").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".cm-editor").count(), 0, "reader does not mount an editor until needed");
  await checkContextualWriting(page);
  await checkNotionInteractions(page, openSource, replaceSource);
  await checkImageUploads(page, openSource, replaceSource);
  await checkDocumentStructure(page, openSource, replaceSource);
  await checkWriting(page);
  await checkRichObjects(page);
  await checkHistoryAndSearch(page);
  await checkDraftRecovery(page);
  await checkConflicts(page);
  await checkTypingDuringSave(page);
  await checkScrollContinuity(page);
  await checkLayout(page, width);
  assert.deepEqual(errors, []);
  console.log(`Markdown editor ${width}px: preview, live/source, IME, history, search, draft recovery, conflicts and concurrent saves passed`);
}

async function checkContextualWriting(page: Page) {
  await openSource(page);
  await replaceSource(page, "# 对齐标题\n\n普通段落 **强调** 与 `code`。\n\n## 第二节\n\n- 第一项\n- 第二项\n\n> 引用\n\n| 名称 | 状态 |\n| --- | --- |\n| 内容 | 正常 |\n\n```typescript\nconst value = 1;\n```\n\n公式 $E=mc^2$ 与 [可编辑链接](https://example.com)\n\n![图片](https://example.com/image.png)\n\n$$\na^2+b^2=c^2\n$$\n\n结束");
  const geometry = async (selector: string) => page.locator(selector).evaluate(root => {
    const origin = root.getBoundingClientRect();
    return Array.from(root.querySelectorAll("h1,h2,blockquote,table,pre,img[src],.katex-display")).map(element => {
      const box = element.getBoundingClientRect(); const style = getComputedStyle(element);
      return { tag: element.tagName, x: box.x, y: box.y - origin.y, width: box.width, height: box.height, font: style.fontSize, line: style.lineHeight, color: style.color };
    });
  });
  await mode(page, "预览").click();
  await page.locator(".ui-markdown-document img").waitFor();
  const reading = await geometry(".ui-markdown-document > .chat-markdown");
  await mode(page, "编辑").click();
  await richFor(page).waitFor();
  const editing = await geometry(".tiptap");
  assert.equal(reading.length, editing.length);
  for (let index = 0; index < reading.length; index++) {
    for (const key of ["x", "y", "width", "height"] as const) assert.ok(Math.abs(reading[index][key] - editing[index][key]) < 2, `${reading[index].tag} ${key} matches between read and edit: ${reading[index][key]} / ${editing[index][key]}`);
    if (reading[index].tag !== "IMG") for (const key of ["font", "line", "color"] as const) assert.equal(reading[index][key], editing[index][key]);
  }
  await checkInlineInspectors(page);
  await checkTableAndCommands(page);
  await checkBlockInteractions(page, openSource, replaceSource);
  await checkMathShortcut(page);
  await checkMathCommandTypes(page);
}

async function checkMathShortcut(page: Page) {
  for (const key of ["Space", "Enter"]) {
    await openSource(page); await replaceSource(page, "公式示例\n\n继续写作");
    await mode(page, "编辑").click();
    await richFor(page).getByText("继续写作", { exact: true }).click();
    await page.waitForFunction(() => { const el = document.querySelector(".tiptap") as HTMLElement & { editor: { state: { selection: { $from: { parent: { textContent: string } } } } } }; return el.editor.state.selection.$from.parent.textContent === "继续写作"; });
    await richFor(page).press("ControlOrMeta+End");
    await richFor(page).press("Enter");
    await page.keyboard.type("$$"); await page.keyboard.press(key);
    const math = page.getByRole("dialog", { name: "公式块", exact: true });
    await math.locator("textarea").waitFor();
    await math.getByRole("button", { name: "关闭", exact: true }).click();
    assert.equal(await richFor(page).locator(":scope > p").last().innerText(), "$$", "cancel keeps the original shortcut text");
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    await page.keyboard.press(key);
    await math.getByRole("button", { name: "多行示例", exact: true }).click();
    await math.locator(".mtable").waitFor();
    await math.locator("textarea").press("ControlOrMeta+Enter");
    await richFor(page).locator("[data-type=block-math] .mtable").waitFor();
    assert.equal(await richFor(page).locator(":scope > p").allTextContents().then(items => items.includes("$$")), false);
    await mode(page, "预览").click();
    await page.locator(".ui-markdown-document .katex-display .mtable").waitFor();
    await openSource(page);
    const source = await contentOf(page);
    assert.ok(source.includes("$$\n\\begin{aligned}"));
    assert.ok(source.includes("\\\\\nd &= e + f"), "multiline LaTeX survives serialization");
  }
}

async function checkMathCommandTypes(page: Page) {
  for (const [name, selector] of [["行内公式", "p [data-type=inline-math]"], ["公式块", ":scope > [data-type=block-math]"]]) {
    await openSource(page); await replaceSource(page, "公式类型");
    await mode(page, "编辑").click();
    await richFor(page).getByText("公式类型", { exact: true }).click();
    await page.waitForFunction(() => { const el = document.querySelector(".tiptap") as HTMLElement & { editor: { state: { selection: { $from: { parent: { textContent: string } } } } } }; return el.editor.state.selection.$from.parent.textContent === "公式类型"; });
    await richFor(page).press("ControlOrMeta+End"); await richFor(page).press("Enter");
    await page.keyboard.type("/math");
    const options = page.getByRole("listbox").getByRole("option");
    assert.deepEqual(await options.allTextContents(), ["行内公式嵌入文字，与正文同行显示", "公式块独占一块，可编辑多行公式"]);
    await page.screenshot({ path: `/tmp/bibo-math-options-${page.viewportSize()!.width}.png` });
    await page.getByRole("option", { name, exact: true }).click();
    const dialog = page.getByRole("dialog", { name, exact: true });
    await dialog.locator("textarea").fill("x^2");
    await dialog.locator("textarea").press("ControlOrMeta+Enter");
    await richFor(page).locator(selector).waitFor();
    await mode(page, "预览").click();
    assert.equal(await page.locator(".ui-markdown-document .katex-display").count(), name === "公式块" ? 1 : 0);
    await openSource(page);
    assert.ok((await contentOf(page)).includes(name === "公式块" ? "$$\nx^2\n$$" : "$x^2$"));
  }
}

async function checkInlineInspectors(page: Page) {
  await richFor(page).locator("a").click();
  const link = page.getByRole("dialog", { name: "链接", exact: true });
  await link.getByRole("textbox").fill("https://example.com/updated");
  await link.getByRole("button", { name: "确认", exact: true }).click();
  assert.equal(await richFor(page).locator("a").getAttribute("href"), "https://example.com/updated");
  await richFor(page).locator("a").click();
  await link.getByRole("button", { name: "取消链接", exact: true }).click();
  assert.equal(await richFor(page).locator("a").count(), 0);
  assert.ok((await richFor(page).innerText()).includes("可编辑链接"));
  await richFor(page).locator(".tiptap-mathematics-render").first().click();
  const math = page.getByRole("dialog", { name: "行内公式", exact: true });
  await math.locator("textarea").fill("\\frac{a}{b}");
  await math.locator(".katex .mfrac").waitFor();
  assert.equal(await page.locator(".ui-overlay-backdrop").count(), 0, "math stays in a nonmodal contextual panel");
  await math.locator("textarea").press("ControlOrMeta+Enter");
  await richFor(page).locator(".katex .mfrac").waitFor();
}

async function checkTableAndCommands(page: Page) {
  await richFor(page).locator("td").first().click();
  const table = richFor(page).locator(".ui-rich-table");
  assert.equal(await page.getByRole("dialog", { name: "表格", exact: true }).count(), 0, "typing in a cell never opens an obstructing panel");
  await table.getByRole("button", { name: "新增一行", exact: true }).click();
  await table.getByRole("button", { name: "新增一列", exact: true }).click();
  assert.equal(await richFor(page).locator("tr").count(), 3);
  assert.equal(await richFor(page).locator("tr").first().locator("th,td").count(), 3);
  await page.keyboard.press("Escape");
  await richFor(page).locator(":scope > p").last().click();
  await richFor(page).locator(":scope > p").last().evaluate(paragraph => {
    const range = document.createRange(); range.selectNodeContents(paragraph); range.collapse(false);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("/table");
  const commands = page.getByRole("listbox", { name: "插入内容" });
  await commands.getByRole("option", { name: "表格", exact: true }).waitFor();
  assert.equal(await richFor(page).evaluate(element => element === document.activeElement), true, "slash does not steal typing focus");
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await commands.count(), 0, "dismissed slash does not revive on selection changes");
  await page.keyboard.press("ArrowRight");
  for (let index = 0; index < 6; index++) await page.keyboard.press("Backspace");
  await page.keyboard.type("/table");
  await page.keyboard.press("Enter");
  assert.equal(await richFor(page).locator("table").count(), 2);
  await page.keyboard.press("Escape");

}

async function checkWriting(page: Page) {
  await openSource(page);
  await replaceSource(page, documentText);
  await mode(page, "编辑").click();
  await richFor(page).locator("h1").waitFor();
  assert.equal(await richFor(page).locator("strong").innerText(), "重要内容");
  await richFor(page).locator(".katex").first().waitFor();
  const identity = await richFor(page).elementHandle();
  await openSource(page);
  await page.locator(".cm-syntax-keyword").first().waitFor();
  assert.equal(await contentOf(page), documentText);
  await mode(page, "编辑").click();
  await richFor(page).click();
  await richFor(page).press("ControlOrMeta+End");
  await richFor(page).press("Enter");
  const ime = await page.context().newCDPSession(page);
  await ime.send("Input.imeSetComposition", { text: "中文输入", selectionStart: 4, selectionEnd: 4 });
  await ime.send("Input.insertText", { text: "中文输入不会丢失" });
  await ime.detach();
  assert.equal(await richFor(page).evaluate((element, original) => element === original, identity), true, "IME keeps the content DOM");
  await mode(page, "预览").click();
  await page.getByRole("heading", { name: "写作体验" }).waitFor();
  await mode(page, "编辑").click();
  assert.equal(await richFor(page).evaluate((element, original) => element === original, identity), true);
  await richFor(page).press("ControlOrMeta+z");
  assert.ok(!(await richFor(page).innerText()).includes("中文输入不会丢失"));
  await richFor(page).press("ControlOrMeta+Shift+z");
  assert.ok((await richFor(page).innerText()).includes("中文输入不会丢失"));
  await checkCrossBlockHistory(page);
  await openSource(page);
}

async function checkCrossBlockHistory(page: Page) {
  const beforeDelete = await richFor(page).textContent();
  await richFor(page).evaluate((element) => {
    const paragraphs = element.querySelectorAll("p");
    const range = document.createRange();
    range.setStart(paragraphs[0], 0);
    range.setEnd(paragraphs[paragraphs.length - 1], paragraphs[paragraphs.length - 1].childNodes.length);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
  await page.keyboard.press("Backspace");
  assert.notEqual(await richFor(page).textContent(), beforeDelete);
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await richFor(page).textContent(), beforeDelete, "cross-block deletion restores all formatting and content");
  assert.equal(await richFor(page).evaluate((element) => element.contains(window.getSelection()?.anchorNode ?? null)), true, "caret remains in the native document");
}

async function checkHistoryAndSearch(page: Page) {
  assert.ok((await contentOf(page)).includes("中文输入不会丢失"));
  await page.getByRole("button", { name: /查找与替换/ }).filter({ visible: true }).click();
  const search = page.locator(".cm-search input[name=search]");
  await search.fill("中文输入");
  await search.press("Enter");
  await page.locator(".cm-searchMatch").first().waitFor();
  await search.press("Escape");
}

async function checkRichObjects(page: Page) {
  const original = await contentOf(page);
  const extra = "---\ntitle: 保留元数据\n---\n\n" + original + "\n\n| 名称 | 状态 |\n| --- | --- |\n| 功能 | 待办 |\n\n- [ ] 检查待办对齐\n\n脚注[^note]。\n\n[^note]: 原始脚注\n\n<!-- 保留注释 -->\n\n[unused]: https://example.com/reference\n\n```mermaid\nflowchart LR\n A[输入] --> B[保存]\n```\n\n最后一段";
  await replaceSource(page, extra);
  await mode(page, "编辑").click();
  const rich = richFor(page);
  await rich.locator("table").waitFor();
  await rich.locator(".ui-rich-diagram-preview svg").waitFor();
  await checkTaskItem(page);
  await openSource(page);
  assert.equal(await contentOf(page), extra, "mode changes never rewrite the original source");
  await mode(page, "编辑").click();
  await rich.locator("td").first().dblclick();
  await page.keyboard.insertText("完成");
  await formatAction(page, "在下方插入行");
  assert.equal(await rich.locator("tr").count(), 3);
  await formatAction(page, "在右侧插入列");
  assert.equal(await rich.locator("tr").first().locator("th,td").count(), 3);
  await rich.locator(".tiptap-mathematics-render").first().click();
  await page.getByRole("dialog").locator("textarea").fill("a^2+b^2=c^2");
  await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click();
  await page.getByRole("button", { name: /查找与替换/ }).filter({ visible: true }).click();
  await page.getByRole("search").getByRole("textbox", { name: "查找", exact: true }).fill("重要内容");
  await page.getByRole("search").getByRole("textbox", { name: "替换", exact: true }).fill("关键内容");
  await page.getByRole("button", { name: "全部替换", exact: true }).click();
  assert.equal(await rich.locator("strong").innerText(), "关键内容");
  await page.getByRole("search").getByRole("button", { name: "关闭", exact: true }).click();
  await checkRichLinks(page);
  await openSource(page);
  const saved = await contentOf(page);
  for (const preserved of ["title: 保留元数据", "[^note]: 原始脚注", "<!-- 保留注释 -->", "[unused]: https://example.com/reference", "a^2+b^2=c^2", "```typescript", "中文输入不会丢失"]) assert.ok(saved.includes(preserved), `preserved ${preserved}`);
}

async function checkTaskItem(page: Page) {
  const task = richFor(page).locator("li[data-type=taskItem]").first();
  const aligned = await task.evaluate((element) => {
    const box = element.querySelector("input")!.getBoundingClientRect();
    const text = element.querySelector("p")!.getBoundingClientRect();
    return Math.abs(box.top - text.top) < 12 && box.right < text.left;
  });
  assert.equal(aligned, true, "task checkbox and text share one row");
  await task.getByRole("checkbox").check();
  assert.equal(await task.getAttribute("data-checked"), "true");
  await task.getByRole("checkbox").uncheck();
}

async function formatAction(page: Page, name: string) {
  await page.getByRole("button", { name: "更多格式", exact: true }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

async function checkRichLinks(page: Page) {
  const rich = richFor(page);
  await rich.locator("p").last().click();
  await page.keyboard.press("ControlOrMeta+End");
  await formatAction(page, "链接");
  await page.getByRole("dialog").getByRole("textbox", { name: "地址", exact: true }).fill("https://example.com/bibo");
  await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click();
  assert.equal(await rich.locator('a[href="https://example.com/bibo"]').count(), 1);
  await formatAction(page, "图片");
  await page.getByRole("dialog").getByRole("textbox", { name: "地址", exact: true }).fill("https://example.com/image.png");
  await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click();
  assert.equal(await rich.locator('img[src="https://example.com/image.png"]').count(), 1);
  await rich.locator('img[src="https://example.com/image.png"]').click();
  await rich.locator('img[src="https://example.com/image.png"]').dblclick();
  await page.getByRole("dialog").getByRole("textbox", { name: "地址", exact: true }).fill("https://example.com/updated.png");
  await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click();
  assert.equal(await rich.locator('img[src="https://example.com/updated.png"]').count(), 1);
  await rich.locator('img[src="https://example.com/updated.png"]').click();
  await page.keyboard.press("Backspace");
  assert.equal(await rich.locator("img").count(), 0, "selected image deletes as a whole");
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await rich.locator('img[src="https://example.com/updated.png"]').count(), 1, "undo restores deleted image");
}

async function checkListEditing(page: Page) {
  await openSource(page);
  await replaceSource(page, "- 连续列表");
  await mode(page, "编辑").click();
  await richFor(page).locator("li p").click();
  await richFor(page).locator("li p").evaluate((paragraph) => {
    const range = document.createRange(); range.selectNodeContents(paragraph); range.collapse(false);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("第二项");
  await page.keyboard.press("Tab");
  assert.equal(await richFor(page).locator("li ul li").count(), 1, "Tab nests a list item");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await richFor(page).locator("li ul li").count(), 0, "Shift+Tab lifts the item");
  await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
  assert.equal(await richFor(page).evaluate(() => {
    const node = window.getSelection()?.anchorNode;
    return (node instanceof Element ? node : node?.parentElement)?.closest("li") ?? null;
  }), null, "Enter on an empty list item exits the list");
  await openSource(page);
  const draft = await contentOf(page);
  assert.ok(draft.startsWith("- 连续列表\n- 第二项"));
  return draft;
}

async function checkDraftRecovery(page: Page) {
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByTitle("已保存 · v2").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "写作体验" }).waitFor();
  const listDraft = await checkListEditing(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("本标签页草稿已备份").waitFor();
  await openSource(page);
  assert.equal(await contentOf(page), listDraft, "reload restores dirty draft");
  let fail = true;
  await page.route("**/api/space", async (route) => {
    if (fail && route.request().postDataJSON().action === "file.update") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "测试保存失败" }) });
    return route.fallback();
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("测试保存失败", { exact: true }).waitFor();
  assert.equal(await contentOf(page), listDraft);
  fail = false;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByTitle("已保存 · v3").waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("bibo-file-drafts:smoke")), null);
}

async function checkConflicts(page: Page) {
  await page.evaluate(async () => {
    await fetch("/api/space", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "file.update", input: { id: "file-a", version: 3, content: "# 外部更新" } }) });
  });
  await replaceSource(page, "# 冲突草稿");
  assert.equal(await contentOf(page), "# 冲突草稿", "source input applied before saving");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("文件已在别处更新。你的修改仍保留在这里。").waitFor();
  assert.equal(await contentOf(page), "# 冲突草稿");
  await page.getByRole("button", { name: "读取最新版本", exact: true }).click();
  await page.getByRole("button", { name: "放弃修改并读取", exact: true }).click();
  await page.getByTitle("已保存 · v4").waitFor();
  assert.equal(await contentOf(page), "# 外部更新", "conflict recovery synchronizes the existing editor");
}

async function checkTypingDuringSave(page: Page) {
  let releaseSave: (() => void) | undefined;
  let delaying = true;
  await page.route("**/api/space", async (route) => {
    if (delaying && route.request().postDataJSON().action === "file.update") {
      delaying = false;
      await new Promise<void>((resolve) => { releaseSave = resolve; });
    }
    return route.fallback();
  });
  await replaceSource(page, "# 提交的版本");
  await mode(page, "编辑").click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "保存中…", exact: true }).waitFor();
  await richFor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("保存期间继续修改");
  await openSource(page);
  assert.ok(releaseSave);
  releaseSave();
  await page.getByRole("button", { name: "保存", exact: true }).waitFor();
  assert.ok((await contentOf(page)).includes("保存期间继续修改"), "save responses cannot replace newer typing");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByTitle("已保存 · v6").waitFor();
}

async function checkLayout(page: Page, width: number) {
  await replaceSource(page, documentText);
  await mode(page, "编辑").click();
  await richFor(page).press("ControlOrMeta+End");
  await page.screenshot({ path: `/tmp/bibo-markdown-editor-${width}.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "no page overflow");
  const overflowing = await page.locator(".file-editor-tools button:visible, .ui-markdown-editor-toolbar button:visible").evaluateAll(buttons => buttons.flatMap(button => {
    const box = button.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1 ? [{ label: button.getAttribute("aria-label") || button.textContent, left: box.left, right: box.right, viewport: innerWidth }] : [];
  }));
  assert.deepEqual(overflowing, [], "mode and save controls fit narrow screens");
}

async function checkScrollContinuity(page: Page) {
  await replaceSource(page, Array.from({ length: 300 }, (_, index) => `## 第 ${index + 1} 节\n\n长文阅读与编辑的位置保持。这里包含 **格式文字**、中文输入与常规段落。`).join("\n\n"));
  await mode(page, "预览").click();
  await page.locator(".bibo-file-preview-markdown").evaluate((element) => { element.scrollTop = (element.scrollHeight - element.clientHeight) / 2; });
  await page.waitForFunction(() => document.querySelector(".bibo-file-preview-markdown")!.scrollTop > 100);
  await mode(page, "编辑").click();
  await page.waitForFunction(() => (document.querySelector(".ui-rich-markdown-scroll")?.scrollTop ?? 0) > 100);
  if (page.viewportSize()!.width === 1440) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await richFor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await richFor(page).evaluate((element) => {
      const samples: number[] = []; (window as unknown as { inputFrames: number[] }).inputFrames = samples;
      element.addEventListener("keydown", () => { const start = performance.now(); requestAnimationFrame(() => samples.push(performance.now() - start)); });
    });
    await page.keyboard.type("abcdefghijklmnopqrstuvwxyz1234", { delay: 25 });
    const times = await page.evaluate(() => (window as unknown as { inputFrames: number[] }).inputFrames.sort((a, b) => a - b));
    assert.ok(times.length >= 25);
    console.log(`Integrated 300-section document / CPU 4x: keydown-to-frame p95=${times[Math.floor(times.length * .95)].toFixed(1)}ms`);
    assert.ok(times[Math.floor(times.length * .95)] < 100, "typing does not stall the long document");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await cdp.detach();
  }
  await mode(page, "预览").click();
  await page.waitForFunction(() => document.querySelector(".bibo-file-preview-markdown")!.scrollTop > 100);
  await openSource(page);
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
