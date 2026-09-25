import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page } from "playwright";

const base = "http://127.0.0.1:5189";
const server = spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5189", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
const instant = "2026-09-25T09:00:00.000Z";

async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch { /* Preview is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Bibo preview did not start");
}

async function mockApi(page: Page): Promise<void> {
  const sessions = [{ id: "session-a", title: "产品想法", createdAt: instant, updatedAt: instant, messageCount: 2 }];
  const messages = [{ role: "user", text: "今天先做什么？", at: instant }, { role: "assistant", text: "先整理一件最重要的事。", at: instant }];
  const projects = [{ id: "project-a", name: "Bibo", createdAt: instant, updatedAt: instant, version: 1 }];
  const tasks = [{ id: "task-a", projectId: "project-a", title: "梳理产品方案", description: "确认界面和数据主链路", status: "active", dueAt: null, subtasks: [], source: { kind: "user" }, createdAt: instant, updatedAt: instant, version: 1 }];
  const events = [{ id: "event-a", title: "设计评审", description: "和团队对齐", startAt: new Date(Date.now() + 3_600_000).toISOString(), endAt: new Date(Date.now() + 7_200_000).toISOString(), source: { kind: "user" }, createdAt: instant, updatedAt: instant, version: 1 }];
  const inbox = [{ id: "inbox-a", kind: "decision", title: "确认方案方向", body: "Bibo 已整理好两个候选方案。请阅读后决定。", source: { kind: "task", id: "task-a" }, createdAt: instant, updatedAt: instant, readAt: null as string | null, resolvedAt: null as string | null, version: 1 }];
  const files = [{ id: "file-a", path: "想法.md", kind: "note", createdAt: instant, updatedAt: instant, version: 1 }];
  const contents: Record<string, string> = { "file-a": "# 一个想法\n\n让信息在需要时出现。" };
  const fileAction = (action: string, input: Record<string, unknown>): { result?: unknown; error?: string; status?: number } => {
    if (action === "file.list") return { result: { items: files, nextCursor: null } };
    if (action === "file.get") {
      const file = files.find((item) => item.id === input.id);
      return file ? { result: { ...file, content: contents[file.id] } } : { error: "File missing", status: 404 };
    }
    if (action === "file.create") {
      const file = { id: `file-${files.length}`, path: String(input.path), kind: String(input.kind), createdAt: instant, updatedAt: instant, version: 1 };
      files.push(file); contents[file.id] = String(input.content ?? "");
      return { result: { ...file, content: contents[file.id] } };
    }
    if (action === "file.update" || action === "file.move") {
      const file = files.find((item) => item.id === input.id)!;
      if (file.version !== input.version) return { error: "版本冲突", status: 409 };
      if (action === "file.update") contents[file.id] = String(input.content);
      else file.path = String(input.path);
      file.version += 1;
      return { result: { ...file, content: contents[file.id] } };
    }
    return { error: `Unmocked action: ${action}`, status: 400 };
  };
  const spaceAction = (action: string, input: Record<string, unknown>): { result?: unknown; error?: string; status?: number } => {
    if (action.startsWith("file.")) return fileAction(action, input);
    if (action === "overview.get") return { result: { inbox: inbox.filter((item) => !item.resolvedAt), events, tasks: tasks.filter((item) => item.status !== "done"), notes: files.filter((item) => item.kind === "note"), projects: [{ id: "project-a", name: "Bibo", total: tasks.length, done: tasks.filter((item) => item.status === "done").length }], counts: { unread: inbox.filter((item) => !item.readAt && !item.resolvedAt).length, activeTasks: tasks.filter((item) => item.status !== "done").length } } };
    if (action === "project.list") return { result: { items: projects, nextCursor: null } };
    if (action === "task.list") return { result: { items: tasks, nextCursor: null } };
    if (action === "event.list") return { result: { items: events.filter((event) => (!input.from || event.endAt >= String(input.from)) && (!input.to || event.startAt <= String(input.to))), nextCursor: null } };
    if (action === "inbox.list") return { result: { items: inbox, nextCursor: null } };
    if (action === "task.create") {
      const task = { ...tasks[0]!, ...input, id: `task-${tasks.length}`, version: 1, status: "planned" };
      tasks.push(task); return { result: task };
    }
    if (action === "event.create") {
      const event = { ...events[0]!, ...input, id: `event-${events.length}`, version: 1 };
      events.push(event); return { result: event };
    }
    if (action === "inbox.read" || action === "inbox.resolve") {
      const item = inbox.find((entry) => entry.id === input.id)!;
      item.readAt = new Date().toISOString(); if (action === "inbox.resolve") item.resolvedAt = item.readAt;
      item.version += 1; return { result: item };
    }
    return { error: `Unmocked action: ${action}`, status: 400 };
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.method() === "POST" ? request.postDataJSON() as Record<string, unknown> : {};
    const reply = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (path === "/api/auth/me") return reply({ user: { id: "smoke", email: "smoke@example.com" } });
    if (path === "/api/sessions" && request.method() === "GET") return reply({ sessions });
    if (path === "/api/sessions" && request.method() === "POST") {
      const session = { id: `session-${sessions.length}`, title: "新对话", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 };
      sessions.unshift(session); return reply({ session });
    }
    if (path === "/api/sessions/rename") { const session = sessions.find((item) => item.id === body.id)!; session.title = String(body.title); return reply({ session }); }
    if (path === "/api/sessions/delete") { const index = sessions.findIndex((item) => item.id === body.id); sessions.splice(index, 1); return reply({ ok: true }); }
    if (path === "/api/history") return reply({ messages });
    if (path === "/api/space") {
      const response = spaceAction(String(body.action), (body.input ?? {}) as Record<string, unknown>);
      return reply(response.error ? { error: response.error } : { result: response.result }, response.status ?? 200);
    }
    if (path === "/api/chat") {
      const input = String(body.message);
      messages.push({ role: "user", text: input, at: instant }, { role: "assistant", text: "我们已经把它记下来了。", at: instant });
      const session = sessions[0]!; session.messageCount = messages.length;
      const frames = [
        ["accepted", { runId: "run-a" }], ["delta", { text: "我们已经把它记下来了。" }],
        ["saving", {}], ["committed", { text: "我们已经把它记下来了。", messages, session }],
      ].map(([name, value]) => `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`).join("");
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: frames });
    }
    return reply({ error: `Unmocked path: ${path}` }, 404);
  });
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
  const row = page.locator(".bibo-session-wrap").filter({ has: page.getByRole("button", { name: "新对话", exact: true }) });
  await row.hover();
  const more = row.getByRole("button", { name: "管理会话 新对话" });
  await more.click();
  await page.getByRole("menuitem", { name: "重命名" }).click();
  const dialog = page.getByRole("dialog", { name: "重命名会话" });
  await dialog.getByRole("textbox", { name: "会话名称" }).fill("第二个话题");
  assert.equal(await dialog.getByRole("textbox").evaluate((element) => element === document.activeElement), true, "menu transfers focus to the naming dialog");
  await dialog.getByRole("button", { name: "保存名称" }).click();
  await page.getByRole("button", { name: "第二个话题", exact: true }).waitFor();
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

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await mockApi(page);
      await page.goto(base, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /今天从这里开始/ }).waitFor();
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
      await page.getByRole("heading", { name: "日程" }).waitFor();
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
      await page.getByRole("button", { name: /梳理产品方案/ }).click();
      await page.getByRole("textbox", { name: "任务名称" }).waitFor();
      const taskSaveBox = await page.getByRole("button", { name: "保存任务", exact: true }).boundingBox();
      assert.ok(taskSaveBox && taskSaveBox.y + taskSaveBox.height < viewport.height - (viewport.width < 600 ? 61 : 0), "task save stays visible while fields scroll");
      const taskDescriptionBox = await page.getByRole("textbox", { name: "说明", exact: true }).boundingBox();
      assert.ok(taskDescriptionBox && taskDescriptionBox.y < viewport.height * .5, "task description precedes secondary metadata");
      await page.screenshot({ path: `/tmp/bibo-tasks-${viewport.width}.png`, fullPage: true });
      await page.getByRole("textbox", { name: "任务名称" }).fill("尚未保存的任务草稿");
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: /收件箱/ }).click();
      await page.getByRole("heading", { name: "收件箱" }).waitFor();
      await page.getByRole("button", { name: /确认方案方向/ }).click();
      await page.getByRole("heading", { name: "确认方案方向" }).waitFor();
      await page.screenshot({ path: `/tmp/bibo-inbox-${viewport.width}.png`, fullPage: true });
      if (viewport.width < 600) await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: /任务/ }).click();
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
        await checkNewConversation(page);
      }
      assert.deepEqual(errors, [], "browser should not have runtime errors");
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(layout.width <= layout.viewport + 1, "page should not scroll horizontally");
      await page.close();
    }
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); await once(server, "exit"); }
