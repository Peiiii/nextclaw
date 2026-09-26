import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page } from "playwright";
import { mockApi } from "./personal-workspace.fixture";
const base = "http://127.0.0.1:5189";
const server = spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5189", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch { /* Preview is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Bibo preview did not start");
}

async function checkNewConversation(page: Page): Promise<void> {
  let creates = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/sessions" && request.method() === "POST") creates++; });
  const before = await page.locator(".bibo-session-item").count();
  for (let click = 0; click < 3; click++) await page.getByRole("button", { name: "新建会话" }).click();
  assert.equal(creates, 0, "opening blank conversations never creates server sessions");
  assert.equal(await page.locator(".bibo-session-item").count(), before, "no empty rows are added");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".ui-message").count(), 0, "refresh preserves an explicit blank conversation");
  await page.getByRole("textbox", { name: /告诉 Bibo/ }).fill("新话题的第一条消息");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await page.getByText("我们已经把它记下来了。", { exact: true }).waitFor();
  assert.equal(creates, 1, "first send creates exactly one server session");
  const row = page.locator(".bibo-session-wrap").filter({ has: page.getByRole("link", { name: "新对话", exact: true }) });
  await row.hover();
  const more = row.getByRole("button", { name: "管理会话 新对话" });
  await more.click();
  await page.getByRole("menuitem", { name: "重命名" }).click();
  const dialog = page.getByRole("dialog", { name: "重命名会话" });
  await dialog.getByRole("textbox", { name: "会话名称" }).fill("第二个话题");
  assert.equal(await dialog.getByRole("textbox").evaluate((element) => element === document.activeElement), true, "menu transfers focus to the naming dialog");
  await dialog.getByRole("button", { name: "保存名称" }).click();
  await page.getByRole("link", { name: "第二个话题", exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "账号与帮助" }).click();
  await page.getByRole("menuitem", { name: "使用说明与数据" }).waitFor();
  await page.waitForFunction(() => document.activeElement?.closest("[role=menu]"));
  // Allow the portaled menu to finish mounting its document-level keyboard listener.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "账号与帮助", undefined, { timeout: 1000 });
  assert.equal(await page.getByRole("button", { name: "账号与帮助" }).evaluate((element) => element === document.activeElement), true);
}

async function checkExhaustedNewConversation(page: Page): Promise<void> {
  await page.route("**/api/chat/availability", (route) => route.fulfill({
    status: 429, contentType: "application/json", body: JSON.stringify({ error: "今日试用额度已用完，请明天再试。" }),
  }));
  let creates = 0;
  const onRequest = (request: { url(): string; method(): string }) => {
    if (new URL(request.url()).pathname === "/api/sessions" && request.method() === "POST") creates += 1;
  };
  page.on("request", onRequest);
  await page.getByRole("button", { name: "新建会话" }).click();
  const before = await page.locator(".bibo-session-item").count();
  await page.getByRole("textbox", { name: /告诉 Bibo/ }).fill("请记录我的想法");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await page.getByText(/今日试用额度已用完/).waitFor();
  assert.equal(await page.getByRole("textbox", { name: /告诉 Bibo/ }).inputValue(), "请记录我的想法");
  assert.equal(creates, 0, "exhausted model budget must not create a blank session");
  assert.equal(await page.locator(".bibo-session-item").count(), before);
  page.off("request", onRequest);
  await page.unroute("**/api/chat/availability");
}

async function checkContentBounds(page: Page): Promise<void> {
  const overflow = await page.locator(".bibo-topbar-leading, .bibo-topbar-actions, .workspace-toolbar, .bibo-summary-card, .ui-list-row, .bibo-detail-pane, .bibo-workspace, .ui-overlay, [role=menu], .file-editor-tools").evaluateAll((elements) => elements.flatMap((element) => {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    return box.left < -1 || box.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1
      ? [{ className: element.className, left: box.left, right: box.right, width: element.clientWidth, scrollWidth: element.scrollWidth }] : [];
  }));
  assert.deepEqual(overflow, [], "visible content and actions must fit; an outer overflow:hidden must not conceal broken layout");
}

async function checkTreeKeyboard(page: Page): Promise<void> {
  const node = (name: string) => page.getByRole("treeitem", { name, exact: true });
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("title"));
  await node("A-empty").focus();
  for (const key of ["ArrowRight", "ArrowRight"]) await page.keyboard.press(key);
  assert.equal(await focused(), "A-empty", "an empty folder must not navigate to a sibling");
  await node("alpha").focus(); await page.keyboard.press("ArrowLeft");
  assert.equal(await focused(), "alpha", "a root file has no parent");
  await node("B-folder").focus();
  for (const [key, path] of [["ArrowRight", "B-folder"], ["ArrowRight", "B-folder/nested"], ["ArrowRight", "B-folder/nested"], ["ArrowRight", "B-folder/nested/readme.md"], ["ArrowLeft", "B-folder/nested"], ["ArrowLeft", "B-folder/nested"], ["ArrowUp", "B-folder"], ["ArrowDown", "B-folder/nested"], ["Home", "A-empty"], ["End", "想法.md"]]) {
    await page.keyboard.press(key!); assert.equal(await focused(), path);
  }
  assert.equal(await node("nested").getAttribute("aria-expanded"), "false");
  const group = await node("B-folder").getAttribute("aria-owns");
  assert.ok(group && await page.evaluate((id) => document.getElementById(id)?.getAttribute("role") === "group", group));
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "编辑 想法.md" }).waitFor();
  await node("alpha").click();
  await page.getByLabel("文件操作", { exact: true }).click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await node("alpha").waitFor({ state: "detached" });
  assert.equal(await page.locator('[role="treeitem"][tabindex="0"]').count(), 1, "deleting the focused node preserves a keyboard entry");
  await page.getByRole("textbox", { name: "搜索文件" }).focus(); await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "treeitem");
}

async function checkFileNavigation(page: Page, width: number): Promise<void> {
  await mockApi(page, false, true);
  await page.goto(`${base}/files`, { waitUntil: "networkidle" });
  if (width > 760) await checkTreeKeyboard(page);
  for (let index = 0; index < 10; index++) {
    const back = page.locator(".file-mobile-back button");
    if (await back.isVisible()) await back.click();
    await page.getByRole("treeitem", { name: `review-document-${index}.md`, exact: true }).click();
    await page.getByRole("textbox", { name: `编辑 review-document-${index}.md` }).waitFor();
  }
  await page.waitForFunction(() => {
    const tab = document.querySelector(".bibo-file-tab.is-active")!;
    return tab.getBoundingClientRect().right <= tab.parentElement!.getBoundingClientRect().right + 1;
  });
  const editor = page.getByRole("textbox", { name: "编辑 review-document-9.md" });
  await editor.fill("未保存的文件草稿");
  await page.getByRole("button", { name: "review-document-0.md", exact: true }).click();
  await page.getByRole("button", { name: /^review-document-9\.md/ }).click();
  assert.equal(await editor.inputValue(), "未保存的文件草稿");
  if (width > 760) {
    const resize = page.getByRole("separator", { name: "目录宽度" });
    await resize.focus(); await page.keyboard.press("ArrowRight");
    assert.equal(await resize.getAttribute("aria-valuenow"), "240");
    await page.getByRole("button", { name: "收起目录树", exact: true }).click();
    await page.getByRole("button", { name: "展开目录树", exact: true }).click();
    assert.equal(await editor.inputValue(), "未保存的文件草稿");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByTitle("已保存 · v2").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await resize.getAttribute("aria-valuenow"), "240");
    assert.equal(await editor.inputValue(), "未保存的文件草稿");
  }
  await checkContentBounds(page);
  await page.waitForFunction(() => {
    const tab = document.querySelector(".bibo-file-tab.is-active")!;
    const box = tab.getBoundingClientRect(); const parent = tab.parentElement!.getBoundingClientRect();
    return box.left >= parent.left - 1 && box.right <= parent.right + 1;
  });
}

async function checkWorkspaceRecovery(page: Page): Promise<void> {
  await mockApi(page);
  let failRead = false;
  await page.route("**/api/space", async (route) => {
    if (failRead && route.request().postDataJSON().action === "file.get") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "文件读取暂时失败" }) });
    } else await route.fallback();
  });
  await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开右侧工作区" }).click();
  await page.getByRole("combobox", { name: "工作区文件" }).selectOption("file-a");
  const editor = page.getByRole("textbox", { name: "编辑 想法.md" });
  await editor.fill("# 工作区保留的修改");
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await page.getByRole("button", { name: "打开右侧工作区" }).click();
  assert.equal(await editor.inputValue(), "# 工作区保留的修改");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByTitle("已保存 · v2").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await editor.inputValue(), "# 工作区保留的修改");
  await page.getByRole("button", { name: "关闭工作区" }).click();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("complementary", { name: "右侧工作区" }).count(), 0);
  await page.getByRole("button", { name: "打开右侧工作区" }).click();
  await editor.waitFor();
  failRead = true;
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("文件读取暂时失败", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "暂时无法打开文件" }).waitFor();
  failRead = false;
  await page.getByRole("button", { name: "重试打开", exact: true }).click();
  await editor.waitFor();
  assert.equal(await editor.inputValue(), "# 工作区保留的修改");
  await checkContentBounds(page);
  await page.screenshot({ path: `/tmp/bibo-workspace-${page.viewportSize()!.width}.png` });
}

async function checkMissingSession(page: Page, width: number): Promise<void> {
  await page.goto(`${base}/chat/deleted-session`, { waitUntil: "networkidle" });
  await page.getByText("这段对话不存在或已删除。请选择其他对话，或新建对话。", { exact: true }).waitFor();
  assert.equal(await page.locator(".ui-message").count(), 0, "missing source cannot display another conversation");
  assert.equal(new URL(page.url()).pathname.split("/").at(-1), "deleted-session", "invalid source remains identifiable");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("这段对话不存在或已删除。请选择其他对话，或新建对话。", { exact: true }).waitFor();
  if (width <= 760) await page.getByRole("button", { name: "打开菜单" }).click();
  await page.getByRole("link", { name: "产品想法", exact: true }).click();
  await page.getByText("先整理一件最重要的事。", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname.split("/").at(-1), "session-a");
}

async function checkLongConversation(page: Page, width: number): Promise<void> {
  const title = page.locator(".workspace-title");
  assert.equal(await title.getAttribute("title"), await title.textContent(), "full title remains available");
  assert.ok(await title.evaluate((element) => element.getBoundingClientRect().height < 30), "toolbar title stays on one line");
  await page.getByRole("button", { name: "＋ 新对话", exact: true }).click({ trial: true });
  await page.getByRole("button", { name: "打开右侧工作区" }).click();
  await checkContentBounds(page);
  await page.getByRole("button", { name: "关闭工作区" }).click();
  if (width <= 760) await page.getByRole("button", { name: "打开菜单" }).click();
  else await page.locator(".bibo-session-wrap").hover();
  await page.getByRole("button", { name: /^管理会话/ }).click();
  await page.getByRole("menuitem", { name: "重命名" }).click();
  await checkContentBounds(page);
  assert.ok((await page.getByRole("textbox", { name: "会话名称" }).inputValue()).length > 100);
  await page.getByRole("button", { name: "关闭会话操作" }).click();
  if (width <= 760) await page.getByRole("button", { name: "关闭导航" }).click();
}

async function checkLongTitles(page: Page, width: number): Promise<void> {
  await mockApi(page, true);
  for (const view of ["chat", "overview", "tasks", "calendar", "inbox", "notes", "files"]) {
    await page.goto(`${base}/${view === "chat" ? "chat/session-a" : view === "overview" ? "" : view}`, { waitUntil: "networkidle" });
    await checkContentBounds(page);
    if (view === "chat") await checkLongConversation(page, width);
    if (view === "inbox") {
      await page.locator(".ui-list-row").first().click();
      await checkContentBounds(page);
      if (width <= 1100) await page.getByRole("button", { name: "← 全部消息", exact: true }).click();
      await page.locator(".ui-list-row").first().waitFor({ state: "visible" });
    }
    if (view === "tasks" || view === "calendar") {
      await page.locator(view === "tasks" ? ".bibo-task-row" : ".bibo-agenda-event:visible").first().click();
      assert.ok((await page.getByRole("textbox", { name: view === "tasks" ? "任务名称" : "标题", exact: true }).inputValue()).length > 100);
      await checkContentBounds(page);
      await page.getByRole("button", { name: view === "tasks" ? "保存任务" : "保存日程", exact: true }).click({ trial: true });
    }
    if (view === "files" || view === "notes") {
      if (width <= 760 && await page.locator(".file-mobile-back button").isVisible()) await page.locator(".file-mobile-back button").click();
      await page.locator(view === "files" ? '[role="treeitem"]' : ".ui-list-row").first().click();
      await checkContentBounds(page);
      await page.getByRole("button", { name: "文件操作", exact: true }).click();
      await page.getByRole("menuitem", { name: "移动 / 重命名" }).click();
      await checkContentBounds(page);
      await page.getByRole("button", { name: "关闭文件操作" }).click();
    }
    await page.screenshot({ path: `/tmp/bibo-long-${view}-${width}.png` });
  }
}

async function checkMobileDrawerTooltip(page: Page, width: number, touch: boolean): Promise<void> {
  await page.goto(`${base}/chat`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "打开菜单", exact: true });
  if (touch) await trigger.tap(); else await trigger.click();
  const drawer = page.getByRole("dialog", { name: "个人空间" });
  await drawer.waitFor();
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("tooltip").count(), 0, "opening a mobile drawer must not display a tooltip");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "dialog");
  await page.screenshot({ path: `/tmp/bibo-mobile-drawer-${width}${touch ? "" : "-hybrid"}.png` });
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "关闭导航");
  await page.getByRole("button", { name: "新建会话" }).focus();
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("tooltip").count(), 0, "a focused drawer action must not show a floating tooltip");
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "打开菜单", undefined, { timeout: 1500 });
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("tooltip").count(), 0, "restoring focus must not display a tooltip");
}

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await mockApi(page);
      await checkMissingSession(page, viewport.width);
      await page.goto(base, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /最近你在忙这些|今天从这里开始/ }).waitFor();
      assert.equal(await page.getByText("确认方案方向").count(), 1);
      await page.screenshot({ path: `/tmp/bibo-product-${viewport.width}.png`, fullPage: true });
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("link", { name: /笔记/ }).click();
      await page.getByRole("button", { name: /想法.md/ }).first().click();
      const editor = page.getByRole("textbox", { name: "编辑 想法.md" });
      await editor.fill("# 更新过的想法");
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await page.getByTitle("已保存 · v2").waitFor();
      const editorBox = await editor.boundingBox();
      assert.ok(editorBox && editorBox.y < 180 && editorBox.height > viewport.height * .6, "note content occupies the main workspace at desktop and mobile sizes");
      assert.equal(await page.getByRole("button", { name: "保存", exact: true }).isDisabled(), true, "saved file disables the shared action");
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("link", { name: /文件/ }).click();
      await page.getByRole("treeitem", { name: /想法.md/ }).click();
      await page.getByRole("textbox", { name: "编辑 想法.md" }).waitFor();
      assert.equal(await page.getByRole("textbox", { name: "编辑 想法.md" }).inputValue(), "# 更新过的想法");
      await page.getByRole("button", { name: "预览", exact: true }).click();
      await page.getByRole("heading", { name: "更新过的想法" }).waitFor();
      assert.equal(await page.getByRole("group", { name: "文件模式" }).getByRole("button", { name: "预览" }).getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: "编辑", exact: true }).click();
      await page.screenshot({ path: `/tmp/bibo-files-${viewport.width}.png`, fullPage: true });
      if (viewport.width === 1440) {
        await page.getByLabel("文件操作", { exact: true }).click();
        await page.getByRole("menuitem", { name: "移动 / 重命名" }).click();
        await page.getByRole("textbox", { name: "文件新路径" }).fill("新的想法.md");
        await page.getByRole("button", { name: "确认移动" }).click();
        await page.getByRole("textbox", { name: "编辑 新的想法.md" }).waitFor();
      }
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: /日程/ }).click();
      await page.getByRole("heading", { name: "日程", exact: true }).waitFor();
      const calendarAction = page.getByRole("button", { name: "＋ 新日程" });
      const calendarStyle = await calendarAction.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, radius: style.borderRadius, font: style.fontSize };
      });
      await calendarAction.hover();
      assert.notEqual(await calendarAction.evaluate((element) => getComputedStyle(element).backgroundColor), calendarStyle.background, "shared action has hover feedback");
      await calendarAction.focus();
      await page.keyboard.press("ArrowDown");
      assert.equal(await calendarAction.evaluate((element) => getComputedStyle(element).outlineStyle), "solid", "shared action has keyboard focus feedback");
      assert.equal(await page.getByRole("group", { name: "日程视图" }).getByRole("button", { name: "月", exact: true }).getAttribute("aria-pressed"), "true");
      const monthCells = page.locator(".calendar-date-select");
      assert.ok([28, 35, 42].includes(await monthCells.count()), "month shows complete calendar weeks");
      const currentMonth = await page.locator(".calendar-period > strong").textContent();
      await page.getByRole("button", { name: "下一段时间" }).click();
      assert.notEqual(await page.locator(".calendar-period > strong").textContent(), currentMonth);
      await page.getByRole("button", { name: "今天", exact: true }).click();
      assert.equal(await page.locator(".calendar-period > strong").textContent(), currentMonth);
      await page.locator(".bibo-space-scroll").evaluate((element) => element.scrollTo({ top: 0 }));
      await page.screenshot({ path: `/tmp/bibo-calendar-${viewport.width}.png`, fullPage: true });
      const eventBox = await page.getByRole("button", { name: /设计评审/ }).first().boundingBox();
      assert.ok(eventBox && eventBox.y < viewport.height - 70, "today's event should be visible before scrolling");
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: /任务/ }).click();
      await page.getByRole("heading", { name: "任务", exact: true }).waitFor();
      const taskStyle = await page.getByRole("button", { name: "＋ 新任务" }).evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, radius: style.borderRadius, font: style.fontSize };
      });
      assert.deepEqual(taskStyle, calendarStyle, "same-level actions use one shared component state");
      const taskRow = page.locator(".bibo-task-row").filter({ hasText: "梳理产品方案" });
      assert.match(await taskRow.innerText(), /Bibo.*进行中/s, "task list shows project and state without opening details");
      await taskRow.click();
      await page.getByRole("textbox", { name: "任务名称" }).waitFor();
      const taskSaveBox = await page.getByRole("button", { name: "保存任务", exact: true }).boundingBox();
      assert.ok(taskSaveBox && taskSaveBox.y + taskSaveBox.height < viewport.height - (viewport.width < 600 ? 61 : 0), "task save stays visible while fields scroll");
      const taskDescriptionBox = await page.getByRole("textbox", { name: "说明", exact: true }).boundingBox();
      assert.ok(taskDescriptionBox && taskDescriptionBox.y < viewport.height * .5, "task description precedes secondary metadata");
      await page.screenshot({ path: `/tmp/bibo-tasks-${viewport.width}.png`, fullPage: true, animations: "disabled" });
      await page.getByRole("textbox", { name: "任务名称" }).fill("尚未保存的任务草稿");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: /收件箱/ }).click();
      await page.getByRole("heading", { name: "收件箱" }).waitFor();
      await page.getByRole("button", { name: /确认方案方向/ }).click();
      await page.getByRole("heading", { name: "确认方案方向" }).waitFor();
      await page.screenshot({ path: `/tmp/bibo-inbox-${viewport.width}.png`, fullPage: true });
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: /任务/ }).click();
      await page.locator(".bibo-task-row").filter({ hasText: "梳理产品方案" }).click();
      assert.equal(await page.getByRole("textbox", { name: "任务名称" }).inputValue(), "尚未保存的任务草稿", "module navigation preserves task draft");
      await page.getByRole("button", { name: "取消", exact: true }).click();
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: /对话/ }).click();
      await page.getByRole("region", { name: "与 Bibo 对话" }).waitFor();
      await page.screenshot({ path: `/tmp/bibo-chat-${viewport.width}.png`, fullPage: true });
      if (viewport.width === 1440) {
        await page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: /日程/ }).click();
        await page.getByRole("button", { name: /设计评审/ }).first().click();
        await page.getByRole("textbox", { name: "标题" }).waitFor();
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        await checkNewConversation(page);
        await checkExhaustedNewConversation(page);
      }
      assert.deepEqual(errors, [], "browser should not have runtime errors");
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(layout.width <= layout.viewport + 1, "page should not scroll horizontally");
      await page.close();
    }
    for (const [width, touch] of [[320, true], [390, true], [390, false], [768, false], [1440, false]] as const) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: touch, isMobile: touch });
      if (width === 390 && !touch) await mockApi(page);
      else await checkLongTitles(page, width);
      if (width <= 390) await checkMobileDrawerTooltip(page, width, touch);
      await page.close();
    }
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 760 });
      await checkWorkspaceRecovery(page);
      await page.close();
      const filesPage = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 760 });
      await checkFileNavigation(filesPage, width);
      await filesPage.close();
    }
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); await once(server, "exit"); }
