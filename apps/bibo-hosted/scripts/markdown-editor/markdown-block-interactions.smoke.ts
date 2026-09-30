import { openMarkdownBody } from "../personal-workspace.fixture";
import assert from "node:assert/strict";
import type { Page } from "playwright";
const richFor = (page: Page) => page.locator(".tiptap:visible");

async function blockMenu(page: Page, selector: string) {
  const block = richFor(page).locator(selector).first();
  await block.hover();
  const handle = page.getByRole("button", { name: "块操作", exact: true });
  await handle.waitFor();
  // The upstream handle positions in the next animation frame.
  await page.waitForFunction(() => {
    const handle = document.querySelector(".ui-markdown-block-handle");
    return handle instanceof HTMLElement && handle.style.left !== "";
  });
  await handle.click();
  return page.getByRole("menu", { name: "块操作", exact: true });
}

export async function checkBlockInteractions(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, text: string) => Promise<void>) {
  for (const [source, selector, kind] of [
    ["普通正文", ":scope > p:first-child", "文本"],
    ["## 标题", "h2", "标题"],
    ["> 引用正文", "blockquote", "引用"],
    ["```js\nconst answer = 42;\n```", ".ui-rich-code-block", "代码"],
    ["| A | B |\n| --- | --- |\n| 1 | 2 |", ".ui-rich-table", "表格"],
    ["![图片](https://example.com/image.png)", ".ui-rich-image", "图片"],
    ["$$\na^2+b^2=c^2\n$$", "[data-type=block-math]", "公式"],
    ["---", "hr", "分隔线"],
  ]) {
    console.log(`Block operations: ${kind}`);
    await openSource(page); await replaceSource(page, source + "\n\n后续正文");
    await openMarkdownBody(page);
    const original = await richFor(page).textContent();
    const menu = await blockMenu(page, selector);
    assert.equal(await page.locator(".ui-markdown-block-kind").first().innerText(), kind);
    await page.getByRole("textbox", { name: "搜索操作…" }).fill("删除");
    await menu.getByRole("menuitem", { name: /删除/ }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    assert.equal(await richFor(page).innerText(), "后续正文", "only the requested block is removed");
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal(await richFor(page).textContent(), original, "undo restores the complete block");
    await blockMenu(page, selector);
    await page.getByRole("menuitem", { name: "创建副本", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal(await richFor(page).textContent(), original, "duplicate has an independent undo step");
    await blockMenu(page, selector);
    await page.getByRole("menuitem", { name: "在下方插入", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    await page.keyboard.type("After block");
    assert.ok((await richFor(page).innerText()).includes("After block"));
    assert.ok(!(await richFor(page).locator(selector).first().innerText()).includes("After block"), "continued writing is outside the object");
  }
  await checkNestedBlocks(page, openSource, replaceSource);
  await checkBlockKeyboardAndDrag(page, openSource, replaceSource);
  await checkTableInsertionFocus(page, openSource, replaceSource);
}

async function checkBlockKeyboardAndDrag(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, text: string) => Promise<void>) {
  await openSource(page); await replaceSource(page, "转换正文\n\n第二段\n\n第三段");
  await openMarkdownBody(page);
  await checkConversionAndDrag(page);
  await richFor(page).locator(":scope > p").first().click();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menu", { name: "块操作", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "搜索操作…" }).press("Escape");
}

async function checkNestedBlocks(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, text: string) => Promise<void>) {
  await openSource(page); await replaceSource(page, "- 父项\n  - 子项\n    - 孙项\n- 兄弟项\n\n末尾");
  await openMarkdownBody(page);
  const nested = "li li:first-child > p";
  await blockMenu(page, nested);
  assert.equal(await page.locator(".ui-markdown-block-kind").first().innerText(), "列表项");
  await page.getByRole("menuitem", { name: /删除/ }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
  assert.equal(await richFor(page).locator("li").count(), 2);
  assert.ok((await richFor(page).innerText()).includes("兄弟项"));
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await richFor(page).locator("li").count(), 4);
  await blockMenu(page, nested);
  await page.getByRole("menuitem", { name: "创建副本", exact: true }).click();
  assert.equal(await richFor(page).locator("li").count(), 6, "duplicate preserves descendant items");
  await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
  await page.keyboard.press("ControlOrMeta+z");
}

async function checkTableInsertionFocus(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, text: string) => Promise<void>) {
  for (const [menu, action, row, column] of [
    ["行操作", "在上方插入行", 1, 1], ["行操作", "在下方插入行", 2, 1],
    ["列操作", "在左侧插入列", 1, 1], ["列操作", "在右侧插入列", 1, 2],
  ] as const) {
    await openSource(page); await replaceSource(page, "| A | B |\n| --- | --- |\n| C | D |\n\n结束");
    await openMarkdownBody(page);
    const table = richFor(page).locator("table");
    await table.locator("tr").nth(1).locator("td").nth(1).hover();
    const trigger = page.getByRole("button", { name: menu, exact: true });
    const metrics = await trigger.evaluate(element => {
      const style = getComputedStyle(element), hover = getComputedStyle(element, "::before");
      return [style.width, style.height, style.padding, hover.width, hover.height];
    });
    assert.deepEqual(metrics, ["18px", "18px", "0px", "18px", "18px"], "table handles use compact geometry, including hover surface");
    await trigger.click();
    await page.getByRole("menuitem", { name: action, exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    await page.keyboard.type("NEW");
    assert.equal(await table.locator("tr").nth(row).locator("td,th").nth(column).innerText(), "NEW", "typing goes into the newly inserted cell");
  }
  await blockMenu(page, ".ui-rich-table");
  assert.equal(await richFor(page).locator(".ui-rich-table").evaluate(element => getComputedStyle(element).outlineOffset), "-2px", "table selection has no outer gap");
  await page.getByRole("textbox", { name: "搜索操作…" }).press("Escape");
}

async function checkConversionAndDrag(page: Page) {
  await blockMenu(page, ":scope > p:first-child");
  await page.getByRole("menuitem", { name: "转换成", exact: true }).click();
  await page.getByRole("menuitem", { name: "标题 2", exact: true }).click();
  assert.equal(await richFor(page).locator("h2").innerText(), "转换正文");
  await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await richFor(page).locator("h2").count(), 0);
  const first = richFor(page).locator(":scope > p").first();
  await first.hover();
  const handle = page.getByRole("button", { name: "块操作", exact: true });
  await handle.waitFor();
  const destination = await richFor(page).locator(":scope > p").last().boundingBox();
  const source = await handle.boundingBox(); assert.ok(destination && source);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + 30, destination.y + destination.height - 2, { steps: 12 });
  await page.mouse.move(destination.x + 30, destination.y + destination.height + 3);
  await page.mouse.up();
  assert.deepEqual(await richFor(page).locator(":scope > p").allTextContents(), ["第二段", "第三段", "转换正文"], "handle drag moves the actual block");
  await richFor(page).press("ControlOrMeta+z");
  assert.deepEqual(await richFor(page).locator(":scope > p").allTextContents(), ["转换正文", "第二段", "第三段"]);
}
