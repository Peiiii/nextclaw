import assert from "node:assert/strict";
import type { Page } from "playwright";

export async function checkDocumentStructure(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, value: string) => Promise<void>) {
  const mode = (name: string) => page.getByRole("group", { name: "文件模式" }).getByRole("button", { name, exact: true });
  await openSource(page);
  await replaceSource(page, "<details open><summary><strong>More context</strong></summary><p>Hidden content</p></details>\n\n> [!TIP]\n> Useful advice\n\nText <u>underlined</u> and <mark>highlighted</mark>.\n\nEnd");
  await mode("编辑").click();
  const rich = page.locator(".tiptap:visible");
  await rich.locator("[data-type=details] summary strong").waitFor();
  assert.equal(await rich.locator("u").innerText(), "underlined");
  assert.equal(await rich.locator("mark").innerText(), "highlighted");
  assert.equal(await rich.locator("blockquote[data-callout=tip]").innerText(), "Useful advice");
  await checkToggleVisibility(page);
  await checkStructureBlockActions(page);
  await rich.getByText("End", { exact: true }).click();
  await waitForTextSelection(page, "End");
  await page.keyboard.type(" changed");
  await openSource(page);
  const source = (await page.locator(".cm-content .cm-line").allTextContents()).join("\n");
  assert.match(source, /<details open/);
  assert.match(source, /<u>underlined<\/u>/);
  assert.match(source, /<mark>highlighted<\/mark>/);
  assert.match(source, /> \[!TIP\]/);
  await mode("预览").click();
  await checkStructureReading(page);
  await mode("编辑").click();
  await rich.getByText("Hidden content", { exact: true }).waitFor();
  await checkToggleInsertion(page);
  console.log("Document structure: official toggle, GFM callout, emphasis and source/read/edit preservation passed");
  await checkDocumentNavigation(page, openSource, replaceSource);
}

async function checkStructureReading(page: Page) {
  const reader = page.locator(".ui-markdown-document");
  await reader.locator("[data-document-details] strong").waitFor();
  await reader.getByText("Hidden content", { exact: true }).waitFor();
  assert.equal(await reader.locator("blockquote[data-callout=tip]").innerText(), "Useful advice");
  assert.equal(await reader.locator("mark").innerText(), "highlighted");
  await reader.getByRole("button", { name: "More context", exact: true }).click();
  await reader.getByText("Hidden content", { exact: true }).waitFor({ state: "hidden" });
}

async function checkToggleVisibility(page: Page) {
  const rich = page.locator(".tiptap:visible"), toggle = rich.getByRole("button", { name: "展开或收起内容", exact: true });
  await toggle.click();
  await rich.getByText("Hidden content", { exact: true }).waitFor({ state: "hidden" });
  await toggle.click();
  await rich.getByText("Hidden content", { exact: true }).waitFor();
}

async function checkToggleInsertion(page: Page) {
  const rich = page.locator(".tiptap:visible");
  await page.getByRole("button", { name: "更多格式", exact: true }).click();
  await page.getByRole("menuitem", { name: "插入内容", exact: true }).click();
  await page.getByRole("option", { name: "折叠块", exact: true }).click();
  await page.keyboard.type("Inserted toggle");
  assert.equal(await rich.locator("summary").last().innerText(), "Inserted toggle");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Inside toggle");
  assert.match(await rich.locator("[data-type=detailsContent]").last().innerText(), /Inside toggle/);
}

async function checkStructureBlockActions(page: Page) {
  const rich = page.locator(".tiptap:visible");
  for (const [selector, text] of [["[data-type=details]", "More context"], ["blockquote[data-callout=tip]", "Useful advice"]]) {
    await rich.getByText(text, { exact: true }).click();
    await waitForTextSelection(page, text);
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: "创建副本", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    assert.equal(await rich.locator(selector).count(), 2, `duplicate ${selector}: ${await rich.innerHTML()}`);
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal(await rich.locator(selector).count(), 1, `duplicate undo restores ${selector}: ${await rich.innerHTML()}`);
    await rich.getByText(text, { exact: true }).click();
    await waitForTextSelection(page, text);
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: "删除 Del", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    assert.equal(await rich.locator(selector).count(), 0);
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal(await rich.locator(selector).count(), 1);
  }
}

async function waitForTextSelection(page: Page, text: string) {
  // Observe selectionchange settlement; never mutate the editor to make the scenario pass.
  await page.waitForFunction(expected => {
    const root = document.querySelector(".tiptap") as HTMLElement & { editor: { state: { selection: { $from: { parent: { textContent: string } } } } } };
    return root?.editor.state.selection.$from.parent.textContent === expected;
  }, text);
}

async function checkDocumentNavigation(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, value: string) => Promise<void>) {
  const mode = (name: string) => page.getByRole("group", { name: "文件模式" }).getByRole("button", { name, exact: true });
  await openSource(page);
  await replaceSource(page, Array.from({ length: 30 }, (_, index) => `## Section ${index}\n\nParagraph ${index}.\n\nMore context.`).join("\n\n"));
  await mode("预览").click();
  await page.getByRole("button", { name: "目录与排版", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "目录与排版", exact: true });
  assert.equal(await panel.getByRole("navigation").getByRole("button").count(), 30);
  await panel.getByRole("button", { name: "Section 20", exact: true }).click();
  const section = page.locator(".ui-markdown-document").getByRole("heading", { name: "Section 20", exact: true });
  const headingBox = await section.boundingBox();
  const viewport = await page.locator(".bibo-file-preview-markdown").boundingBox();
  assert.ok(headingBox && viewport && Math.abs(headingBox.y - viewport.y) < 2, "outline scrolls the reading surface to the exact heading");
  await page.getByRole("button", { name: "目录与排版", exact: true }).click();
  await panel.getByRole("group", { name: "页面宽度" }).getByRole("button", { name: "全宽", exact: true }).click();
  await panel.getByRole("group", { name: "文字大小" }).getByRole("button", { name: "小号", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".ui-markdown-document > .chat-markdown").evaluate(el => getComputedStyle(el).fontSize), "13px");
  await mode("编辑").click();
  assert.equal(await page.locator(".tiptap:visible").evaluate(el => getComputedStyle(el).fontSize), "13px");
  await page.getByRole("button", { name: "目录与排版", exact: true }).click();
  await panel.getByRole("group", { name: "页面宽度" }).getByRole("button", { name: "标准", exact: true }).click();
  await panel.getByRole("group", { name: "文字大小" }).getByRole("button", { name: "标准", exact: true }).click();
  await panel.getByRole("button", { name: "Section 3", exact: true }).click();
  const editHeading = await page.locator(".tiptap:visible").getByRole("heading", { name: "Section 3", exact: true }).boundingBox();
  const editViewport = await page.locator(".ui-rich-markdown-scroll").boundingBox();
  assert.ok(editHeading && editViewport && Math.abs(editHeading.y - editViewport.y) < 2, "outline navigates rich editing without changing content");
  console.log("Document navigation: headings, exact scroll targets, shared full-width/small-text presentation passed");
}
