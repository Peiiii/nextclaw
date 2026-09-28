import { openMarkdownSource } from "../personal-workspace.fixture";
import assert from "node:assert/strict";
import type { Locator, Page, Route } from "playwright";

export async function checkWorkspaceReopening(page: Page): Promise<Locator> {
  await openMarkdownSource(page);
  const editor = page.getByRole("textbox", { name: "编辑 想法.md" });
  await editor.fill("# 工作区保留的修改");
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await page.getByRole("button", { name: "打开右侧工作区" }).click();
  assert.equal(await editor.textContent(), "# 工作区保留的修改");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByTitle("已保存 · v2").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await openMarkdownSource(page);
  assert.equal(await editor.textContent(), "# 工作区保留的修改");
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("complementary", { name: "右侧工作区" }).count(), 0);
  await page.getByRole("button", { name: "打开右侧工作区" }).click();
  await openMarkdownSource(page);
  await editor.waitFor();
  return editor;
}

export async function openWorkspaceFile(page: Page, parts: readonly string[]): Promise<void> {
  await page.getByRole("button", { name: "浏览目录", exact: true }).click();
  for (const name of parts) {
    const gap = await page.getByRole("dialog", { name: "浏览目录" }).locator(".file-directory-entry").first().evaluate((row) => {
      const icon = row.querySelector(".bibo-file-kind-icon")!.getBoundingClientRect();
      const title = row.querySelector("span:not(.bibo-file-kind-icon)")!.getBoundingClientRect();
      return title.left - icon.right;
    });
    assert.equal(gap, 8, "directory icon and name stay adjacent");
    await page.getByRole("dialog", { name: "浏览目录" }).getByRole("button", { name, exact: true }).click();
  }
}

export async function checkMissingRestoredFile(page: Page, base: string): Promise<void> {
  await page.evaluate(() => localStorage.setItem("space-layout:smoke", JSON.stringify({
    tabs: ["file-a", "missing-file"], activeFileId: "file-a", workspaceOpen: true, workspaceFileId: "missing-file",
  })));
  await page.goto(`${base}/files`, { waitUntil: "networkidle" });
  await openMarkdownSource(page);
  await page.getByRole("textbox", { name: "编辑 想法.md" }).waitFor();
  assert.equal(await page.getByText("File missing", { exact: true }).count(), 0, "a missing restored tab must not warn about the existing file");
  assert.equal(await page.locator(".bibo-file-tab").count(), 1, "the missing restored tab is removed");
}

async function checkTwoRows(page: Page, surface: Locator, width: number, workspace: boolean): Promise<void> {
  const layout = await surface.evaluate((node, workspace) => {
    const header = document.querySelector(workspace ? ".bibo-workspace-head" : ".bibo-topbar")!.getBoundingClientRect();
    const tools = node.querySelector(".bibo-file-editor-head")!.getBoundingClientRect();
    const content = node.querySelector(".bibo-file-editor-surface:not([hidden]), .bibo-file-preview-markdown, iframe")!.getBoundingClientRect();
    const overflowControls = Array.from(node.querySelectorAll(".bibo-file-editor-head button")).flatMap((button) => {
      const box = button.getBoundingClientRect();
      return box.top >= tools.top && box.bottom <= tools.bottom ? [] : [{ label: button.textContent, top: box.top, bottom: box.bottom, toolbarTop: tools.top, toolbarBottom: tools.bottom }];
    });
    return { header: header.height, tools: tools.height, overflowControls, adjacent: header.bottom === tools.top && tools.bottom === content.top, overflow: document.documentElement.scrollWidth > innerWidth };
  }, workspace);
  assert.equal(layout.header, width > 760 ? 44 : 56);
  assert.equal(layout.tools, 44, "paths and operations occupy exactly one row");
  assert.deepEqual(layout.overflowControls, [], "controls never wrap or overflow the toolbar row");
  assert.equal(layout.adjacent, true, "content starts immediately after the two chrome rows");
  assert.equal(layout.overflow, false);
}

export async function checkWorkspaceFiles(page: Page, width: number, base: string): Promise<void> {
  const save = page.getByRole("button", { name: "保存", exact: true });
  if (await save.isVisible()) { await save.click(); await page.getByTitle("已保存 · v2").waitFor(); }
  await checkTwoRows(page, page.locator(".bibo-file-workbench"), width, false);
  await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开右侧工作区" }).click();
  const workspace = page.getByRole("complementary", { name: "右侧工作区" });
  await openWorkspaceFile(page, ["B-folder", "nested", "readme.md"]);
  await checkFileDrafts(page, workspace, width);
  await checkEmptyDirectory(page, workspace);
  await page.screenshot({ path: `/tmp/bibo-file-workspace-${width}.png`, fullPage: true });
  while (await workspace.getByRole("button", { name: /^关闭 / }).count()) await workspace.getByRole("button", { name: /^关闭 / }).first().click();
  await workspace.getByRole("heading", { name: "选择文件或笔记" }).waitFor();
  await openWorkspaceFile(page, ["想法.md"]);
  await openMarkdownSource(page, workspace);
  await workspace.getByRole("textbox", { name: "编辑 想法.md" }).waitFor();
  await checkDirectoryRead(page, base);
  await workspace.getByRole("button", { name: "关闭工作区" }).click();
}

async function checkFileActionReveal(fileRow: Locator, rowAction: Locator): Promise<void> {
  const resting = await fileRow.evaluate((row) => ({
    touch: matchMedia("(hover: none)").matches,
    opacity: getComputedStyle(row.querySelector(".ui-row-action-tray")!).opacity,
    pointerEvents: getComputedStyle(row.querySelector(".ui-row-action-tray")!).pointerEvents,
    gradient: getComputedStyle(row.querySelector(".ui-row-action-tray")!, "::before").backgroundImage,
    mainRight: row.querySelector(".bibo-tree-main")!.getBoundingClientRect().right,
    rowRight: row.getBoundingClientRect().right,
  }));
  assert.equal(resting.opacity, resting.touch ? "1" : "0", "file actions are revealed on hover or remain available on touch screens");
  assert.equal(resting.pointerEvents, "none", "hidden file actions do not intercept row clicks");
  assert.equal(resting.gradient, "none", "row action buttons have no built-in fade");
  assert.ok(resting.mainRight >= resting.rowRight - 8, "hidden actions do not reserve title width");
  await fileRow.hover();
  await rowAction.hover();
  const feedback = await rowAction.evaluate((button) => ({
    icon: getComputedStyle(button, "::before").backgroundColor,
    row: getComputedStyle(button.closest(".bibo-tree-row")!).backgroundColor,
  }));
  assert.notEqual(feedback.icon, feedback.row, "file actions remain visible against the hovered row");
}

async function checkNoteRowActions(page: Page, base: string, backToDirectory: Locator): Promise<void> {
  await page.goto(`${base}/notes`, { waitUntil: "networkidle" });
  if (await backToDirectory.isVisible()) await backToDirectory.click();
  const noteRow = page.locator(".bibo-note-list .ui-list-row-group").filter({ hasText: "想法.md" });
  const noteAction = noteRow.getByRole("button", { name: "管理笔记 想法.md" });
  assert.equal(await noteRow.locator(".ui-row-action-tray").evaluate((tray) => getComputedStyle(tray, "::before").backgroundImage), "none", "note actions have no built-in fade");
  if (await page.evaluate(() => matchMedia("(hover: none)").matches)) {
    await noteAction.click();
    await page.getByRole("menuitem", { name: "移动 / 重命名" }).waitFor();
    await page.keyboard.press("Escape");
    return;
  }
  await noteRow.locator(".ui-list-row").click();
  await noteAction.hover();
  const note = await noteRow.evaluate((row) => ({
    parent: getComputedStyle(row).backgroundColor,
    child: getComputedStyle(row.querySelector(".ui-list-row")!).backgroundColor,
    icon: getComputedStyle(row.querySelector(".ui-icon-button")!, "::before").backgroundColor,
  }));
  assert.equal(note.child, "rgba(0, 0, 0, 0)", "selected note draws one row background");
  assert.notEqual(note.icon, note.parent, "more-action hover is visible on a selected note");
}

export async function checkFileRowActions(page: Page, base: string): Promise<void> {
  await page.goto(`${base}/files`, { waitUntil: "networkidle" });
  const backToDirectory = page.locator(".file-mobile-back button");
  if (await backToDirectory.isVisible()) await backToDirectory.click();
  const fileRow = page.locator(".bibo-tree-row").filter({ has: page.getByRole("treeitem", { name: "review-document-0.md", exact: true }) });
  const rowAction = fileRow.getByRole("button", { name: "管理文件 review-document-0.md" });
  await checkFileActionReveal(fileRow, rowAction);
  await rowAction.click();
  await page.getByRole("menuitem", { name: "移动 / 重命名" }).waitFor();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await page.getByRole("dialog", { name: "删除文件？" }).getByRole("button", { name: "取消" }).last().click();
  assert.equal(await fileRow.count(), 1, "cancel keeps the file in the directory");
  await rowAction.click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await page.getByRole("dialog", { name: "删除文件？" }).getByRole("button", { name: "确认删除" }).click();
  await fileRow.waitFor({ state: "detached" });
  if (await backToDirectory.isVisible()) await backToDirectory.click();
  await page.getByRole("treeitem", { name: "review-document-1.md" }).waitFor();
  await page.getByRole("textbox", { name: "搜索文件" }).fill("review-document-1");
  const searchRow = page.locator(".ui-list-row-group").filter({ hasText: "review-document-1.md" });
  await searchRow.hover();
  await searchRow.getByRole("button", { name: "管理文件 review-document-1.md" }).click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await checkNoteRowActions(page, base, backToDirectory);
}

async function checkFileDrafts(page: Page, workspace: Locator, width: number): Promise<void> {
  const directory = page.getByRole("dialog", { name: "浏览目录" });
  const editor = workspace.getByRole("textbox", { name: "编辑 B-folder/nested/readme.md" });
  await openMarkdownSource(page, workspace);
  await editor.fill("# 目录切换保留草稿");
  await checkTwoRows(page, workspace, width, true);
  await workspace.getByRole("button", { name: "预览", exact: true }).click();
  await workspace.getByRole("heading", { name: "目录切换保留草稿" }).waitFor();
  await workspace.getByRole("tab", { name: "B-folder/nested/readme.md", exact: true }).click();
  await workspace.getByRole("heading", { name: "目录切换保留草稿" }).waitFor();
  await checkTwoRows(page, workspace, width, true);
  if (width > 760) {
    const inactive = workspace.locator(".ui-tab-item:not(.is-active)").first();
    const resting = await inactive.evaluate((node) => getComputedStyle(node).backgroundColor);
    await inactive.hover();
    assert.notEqual(await inactive.evaluate((node) => getComputedStyle(node).backgroundColor), resting, "inactive tab hover remains visible on the frame");
  }
  await workspace.getByRole("navigation", { name: "文件路径" }).getByRole("button", { name: "B-folder", exact: true }).click();
  await directory.getByRole("button", { name: "返回上级目录" }).click();
  await directory.getByRole("button", { name: "想法.md", exact: true }).click();
  await workspace.getByRole("tab", { name: "B-folder/nested/readme.md", exact: true }).click();
  await openMarkdownSource(page, workspace);
  assert.equal(await editor.textContent(), "# 目录切换保留草稿");
  await workspace.getByRole("button", { name: "关闭 B-folder/nested/readme.md", exact: true }).click();
  await page.getByRole("dialog", { name: "保存文件修改？" }).getByRole("button", { name: "取消", exact: true }).click();
  assert.equal(await editor.textContent(), "# 目录切换保留草稿");
  await workspace.getByRole("button", { name: "保存", exact: true }).click();
  await workspace.getByTitle("已保存 · v2").waitFor();
  await checkCloseNeighbor(workspace);
}

async function checkCloseNeighbor(workspace: Locator): Promise<void> {
  const names = await workspace.getByRole("tab").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")!));
  const index = names.indexOf("B-folder/nested/readme.md");
  const neighbor = names[index + 1] ?? names[index - 1]!;
  await workspace.getByRole("button", { name: "关闭 B-folder/nested/readme.md", exact: true }).click();
  assert.equal(await workspace.getByRole("tab", { name: neighbor, exact: true }).getAttribute("aria-selected"), "true", "closing current tab selects its neighbor");
}

async function checkEmptyDirectory(page: Page, workspace: Locator): Promise<void> {
  await workspace.getByRole("button", { name: "浏览目录", exact: true }).click();
  const directory = page.getByRole("dialog", { name: "浏览目录" });
  await directory.getByRole("button", { name: "A-empty", exact: true }).click();
  await directory.getByRole("heading", { name: "文件夹为空" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await directory.count(), 0);
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "浏览目录");
  assert.equal(await workspace.getByRole("button", { name: "浏览目录", exact: true }).evaluate((node) => document.activeElement === node), true);
}

async function checkDirectoryRead(page: Page, base: string): Promise<void> {
  let failing = true;
  const read = async (route: Route) => {
    const body = route.request().postDataJSON();
    if (body.action !== "file.list" || body.input.ancestorOf || body.input.cursor) return route.fallback();
    if (failing) return route.fulfill({ status: 503, json: { error: "目录暂时无法读取" } });
    return route.fulfill({ json: { result: { items: [{ id: "navigation-0", path: "A-empty", kind: "folder", version: 1 }], nextCursor: "0" } } });
  };
  await page.route("**/api/space", read);
  try {
    await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "浏览目录", exact: true }).click();
    const directory = page.getByRole("dialog", { name: "浏览目录" });
    await directory.getByText("目录暂时无法读取", { exact: true }).waitFor();
    failing = false;
    await directory.getByRole("button", { name: "重试读取目录", exact: true }).click();
    await directory.getByRole("button", { name: "A-empty", exact: true }).click();
    assert.equal(await directory.getByRole("heading", { name: "文件夹为空" }).count(), 0, "partial lists never claim an empty directory");
    await directory.getByRole("button", { name: "加载更多文件", exact: true }).click();
    await directory.getByRole("heading", { name: "文件夹为空" }).waitFor();
    await page.keyboard.press("Escape");
  } finally { await page.unroute("**/api/space", read); }
}
