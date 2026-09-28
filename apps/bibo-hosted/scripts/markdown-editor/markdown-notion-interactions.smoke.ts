import assert from "node:assert/strict";
import type { Page } from "playwright";

/** Exercise public writing actions; editor state is read only to wait for native selection. */
export async function checkNotionInteractions(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, text: string) => Promise<void>) {
  await openSource(page);
  await replaceSource(page, "Alpha words\n\nSecond paragraph\n\nThird paragraph");
  await page.getByRole("group", { name: "文件模式" }).getByRole("button", { name: "编辑", exact: true }).click();
  const rich = page.locator(".tiptap:visible");
  await checkSelectionFormatting(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+d");
  assert.deepEqual(await rich.locator(":scope > p").allTextContents(), ["Alpha words", "Alpha words", "Second paragraph", "Third paragraph"]);
  await page.keyboard.press("Alt+Shift+ArrowDown");
  assert.deepEqual(await rich.locator(":scope > p").allTextContents(), ["Alpha words", "Second paragraph", "Alpha words", "Third paragraph"]);
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await rich.locator(":scope > p").count(), 3, "duplicate and move are independent undo steps");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Edited ");
  assert.equal(await rich.locator(":scope > p").first().innerText(), "Edited Alpha words");
  await page.locator(".ui-markdown-editor-toolbar").getByRole("button", { name: "插入内容", exact: true }).click();
  await page.getByRole("listbox", { name: "插入内容", exact: true }).getByRole("option", { name: "标题 2", exact: true }).click();
  await page.keyboard.type("Inserted heading");
  assert.equal(await rich.locator("h2").innerText(), "Inserted heading");
  assert.equal(await rich.locator(":scope > *").nth(1).evaluate(element => element.tagName), "H2");
  console.log("Notion writing: selection toolbar, block keyboard, undo and shared insertion passed");
  await checkRichTable(page, openSource, replaceSource);
}

async function checkRichTable(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, text: string) => Promise<void>) {
  await openSource(page);
  await replaceSource(page, "| A | B |\n| --- | --- |\n| 1 $x$ | 2 |\n| 3 | 4 |\n\nEnd");
  const mode = (name: string) => page.getByRole("group", { name: "文件模式" }).getByRole("button", { name, exact: true });
  await mode("编辑").click();
  const rich = page.locator(".tiptap:visible");
  await resizeAndFormatColumn(page);
  if ((page.viewportSize()?.width ?? 0) > 500) await moveAndMergeCells(page);
  const editing = await rich.locator("tr").first().locator("th,td").evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));
  await openSource(page);
  const source = (await page.locator(".cm-content .cm-line").allTextContents()).join("\n");
  assert.ok(source.includes("<table"));
  assert.match(source, /colwidth="\d+/);
  assert.match(source, /align="center"/);
  await mode("预览").click();
  const table = page.locator(".ui-markdown-document table");
  await table.waitFor();
  assert.equal(await table.locator(".katex").count(), 1, "math remains visible inside an HTML table");
  assert.equal(await table.locator("tr").nth(1).locator("th").count(), 1);
  const reading = await table.locator("tr").first().locator("th,td").evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));
  editing.forEach((width, index) => assert.ok(Math.abs(width - reading[index]) < 2, "resized columns match reading geometry"));
  await mode("编辑").click();
  assert.equal(await rich.locator("[data-type=inline-math]").count(), 1, "math remains editable after source round trip");
  assert.equal(await rich.locator("tr").nth(1).locator("th").count(), 1);
  assert.equal(await rich.locator("tr").nth(1).locator("th").evaluate(cell => getComputedStyle(cell).textAlign), "center");
  console.log("Rich table: drag width, column alignment/header and source/read/edit persistence passed");
}

async function resizeAndFormatColumn(page: Page) {
  const rich = page.locator(".tiptap:visible");
  const first = rich.locator("th").first();
  const box = await first.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 45, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await first.hover();
  await page.getByRole("button", { name: "列操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "居中对齐", exact: true }).click();
  await first.hover();
  await page.getByRole("button", { name: "列操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "切换标题列", exact: true }).click();
}

async function moveAndMergeCells(page: Page) {
    const rich = page.locator(".tiptap:visible");
    await rich.locator("tr").nth(1).locator("th").hover();
    await page.getByRole("button", { name: "行操作", exact: true }).click();
    await page.getByRole("menuitem", { name: "向下移动行", exact: true }).click();
    assert.match(await rich.locator("tr").nth(1).innerText(), /3/);
    await page.keyboard.press("ControlOrMeta+z");
    await rich.locator("tr").nth(1).locator("th").click({ position: { x: 8, y: 10 } });
    await waitParagraph(page, "1 ");
    await rich.locator("tr").nth(1).locator("td").click({ modifiers: ["Shift"] });
    await page.getByRole("button", { name: "更多格式", exact: true }).click();
    await page.getByRole("menuitem", { name: "合并单元格", exact: true }).click();
    assert.equal(await rich.locator("[colspan='2']").count(), 1);
}

async function checkSelectionFormatting(page: Page) {
  const rich = page.locator(".tiptap:visible");
  await rich.locator(":scope > p").first().click();
  await waitParagraph(page, "Alpha words");
  for (let index = 0; index < "Alpha words".length; index++) await page.keyboard.press("ArrowLeft", { delay: 30 });
  for (let index = 0; index < "Alpha words".length; index++) await page.keyboard.press("Shift+ArrowRight", { delay: 30 });
  await page.waitForFunction(() => window.getSelection()?.toString() === "Alpha words");
  const formats = page.getByRole("toolbar", { name: "文本格式", exact: true });
  await formats.getByRole("button", { name: /^加粗/ }).click();
  assert.equal(await rich.locator("strong").innerText(), "Alpha words");
  await formats.getByRole("button", { name: "清除格式", exact: true }).click();
  assert.equal(await rich.locator("strong").count(), 0);
  await page.keyboard.press("ArrowRight");
  await formats.waitFor({ state: "hidden" });
}

async function waitParagraph(page: Page, text: string) {
  await page.waitForFunction(expected => {
    const root = document.querySelector(".tiptap") as HTMLElement & { editor: { state: { selection: { $from: { parent: { textContent: string } } } } } };
    return root.editor.state.selection.$from.parent.textContent === expected;
  }, text);
}
