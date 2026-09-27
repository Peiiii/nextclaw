import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { chromium, type Page } from "playwright";
import type { BiboTask, BiboEvent } from "@nextclaw/bibo-client";

const base = process.env.BIBO_SMOKE_BASE ?? "http://127.0.0.1:5194";
const server = process.env.BIBO_SMOKE_BASE ? null : spawn("pnpm", ["exec", "vite", "--mode", "ui", "--host", "127.0.0.1", "--port", "5194", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
const browser = await chromium.launch();

async function ready() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base)).ok) return; } catch { /* Dev service starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Planning smoke server unavailable");
}

function written(page: Page, action: string) {
  return page.waitForResponse((response) => response.url().endsWith("/api/space") && response.request().method() === "POST" && response.request().postDataJSON().action === action);
}

type PlanningCase = { page: Page; prefix: string; created: (kind: "task" | "event", id: string) => void; api: <T>(action: string, input?: Record<string, unknown>) => Promise<T> };

async function checkQuickTasks({ page, prefix, api, created }: PlanningCase) {
  await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
  const quick = page.getByRole("textbox", { name: "快速添加任务", exact: true });
  for (const suffix of ["first", "second"]) {
    await quick.fill(`${prefix}-${suffix}`);
    const create = written(page, "task.create");
    await quick.press("Enter");
    const response = await create;
    assert.equal(response.status(), 200);
    const task = (await response.json()).result as BiboTask;
    created("task", task.id);
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="快速添加任务"]')?.value === "");
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "快速添加任务");
    assert.equal((await api<BiboTask>("task.get", { id: task.id })).title, `${prefix}-${suffix}`);
  }
  const row = page.locator(".ui-list-row-group").filter({ hasText: `${prefix}-first` });
  const title = await row.locator("strong").boundingBox();
  const bounds = await row.boundingBox();
  assert.ok(title && bounds && Math.abs(title.y + title.height / 2 - bounds.y - bounds.height / 2) < 3, "Single-line task title must be vertically centered");
  const normal = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
  await row.locator(".task-complete").hover();
  const completionHover = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.notEqual(completionHover, normal, "Completion action must highlight the entire row");
  await row.locator(".bibo-task-row").hover();
  assert.equal(await row.evaluate((element) => getComputedStyle(element).backgroundColor), completionHover, "Title and completion gutter must share feedback");
}

async function checkRichTask({ page, prefix, api, created }: PlanningCase) {
  const quick = page.getByRole("textbox", { name: "快速添加任务", exact: true });
  await quick.fill(`${prefix}-rich`);
  await page.getByRole("button", { name: "打开完整新建任务", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "任务名称", exact: true }).inputValue(), `${prefix}-rich`);
  await page.getByRole("textbox", { name: "说明", exact: true }).fill("完整背景和完成标准");
  await page.getByPlaceholder("添加一个步骤").fill("核对结果");
  await page.getByPlaceholder("添加一个步骤").press("Enter");
  await page.getByRole("button", { name: "项目、日期与更多属性", exact: true }).click();
  await page.getByRole("combobox", { name: "优先级", exact: true }).selectOption("high");
  const createRich = written(page, "task.create");
  await page.getByRole("button", { name: "保存任务", exact: true }).click();
  const rich = (await (await createRich).json()).result as BiboTask;
  created("task", rich.id);
  await quick.waitFor();
  const saved = await api<BiboTask>("task.get", { id: rich.id });
  assert.equal(saved.description, "完整背景和完成标准");
  assert.equal(saved.priority, "high");
  assert.equal(saved.subtasks[0]?.title, "核对结果");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await checkTaskDialog(page, `${prefix}-rich`);
}

async function checkTaskDialog(page: Page, title: string) {
  await page.locator(".bibo-task-row").filter({ hasText: title }).click();
  const editor = page.getByRole("dialog", { name: "任务详情", exact: true });
  await editor.getByRole("textbox", { name: "任务名称", exact: true }).fill(`${title}-draft`);
  await page.route("**/api/space", async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (body?.action === "task.update") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "详情保存失败" }) });
    else await route.continue();
  });
  await editor.getByRole("button", { name: "保存任务", exact: true }).click();
  await editor.getByRole("alert").filter({ hasText: "详情保存失败" }).waitFor();
  await page.unroute("**/api/space");
  await editor.getByRole("button", { name: "删除任务", exact: true }).click();
  await page.getByRole("dialog", { name: "删除任务？", exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.closest('[role="dialog"]')?.querySelector("h2")?.textContent === "删除任务？");
  await page.getByRole("dialog", { name: "删除任务？", exact: true }).evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  await page.screenshot({ path: `/tmp/workspace-confirm-${page.viewportSize()?.width}.png`, animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "删除任务？", exact: true }).waitFor({ state: "hidden" });
  assert.equal(await editor.isVisible(), true, "Closing confirmation must keep task editor open");
  await page.keyboard.press("Escape");
  await editor.waitFor({ state: "hidden" });
  await page.locator(".bibo-task-row").filter({ hasText: title }).click();
  assert.equal(await editor.getByRole("textbox", { name: "任务名称", exact: true }).inputValue(), `${title}-draft`);
  await editor.getByRole("button", { name: "取消", exact: true }).click();
}

async function checkFailedTask({ page, prefix, api, created }: PlanningCase) {
  const quick = page.getByRole("textbox", { name: "快速添加任务", exact: true });
  await page.route("**/api/space", async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (body?.action === "task.create") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "临时保存失败" }) });
    else await route.continue();
  });
  await quick.fill(`${prefix}-retry`);
  await quick.press("Enter");
  await page.getByText("临时保存失败", { exact: true }).waitFor();
  assert.equal(await quick.inputValue(), `${prefix}-retry`);
  await page.unroute("**/api/space");
  const response = written(page, "task.create");
  await quick.press("Enter");
  const task = (await (await response).json()).result as BiboTask;
  created("task", task.id);
  await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="快速添加任务"]')?.value === "");
  assert.equal((await api<{ items: BiboTask[] }>("task.list", { query: `${prefix}-retry` })).items.length, 1);
}

async function checkTaskDates({ page, prefix, created }: PlanningCase) {
  for (const scope of ["今天", "接下来"]) {
    await page.getByRole("group", { name: "任务范围" }).getByRole("button", { name: scope, exact: true }).click();
    const quick = page.getByRole("textbox", { name: "快速添加任务", exact: true });
    await quick.fill(`${prefix}-${scope}`);
    const response = written(page, "task.create");
    await quick.press("Enter");
    const task = (await (await response).json()).result as BiboTask;
    created("task", task.id);
    const matchesDate = await page.evaluate(({ due, tomorrow }) => {
      const expected = new Date();
      if (tomorrow) expected.setDate(expected.getDate() + 1);
      return new Date(due!).toDateString() === expected.toDateString();
    }, { due: task.dueAt, tomorrow: scope === "接下来" });
    assert.equal(matchesDate, true);
    await page.locator(".bibo-task-row").filter({ hasText: task.title }).waitFor();
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="快速添加任务"]')?.value === "");
  }
}

async function checkPendingInput({ page, prefix, created }: PlanningCase) {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/space", async (route) => {
    if (route.request().method() === "POST" && route.request().postDataJSON().action === "task.create") await held;
    await route.continue();
  });
  const quick = page.getByRole("textbox", { name: "快速添加任务", exact: true });
  await quick.fill(`${prefix}-pending`);
  const response = written(page, "task.create");
  await quick.press("Enter");
  await page.waitForFunction(() => document.querySelector(".task-quick-add")?.getAttribute("aria-busy") === "true");
  await quick.fill(`${prefix}-next`);
  release();
  const task = (await (await response).json()).result as BiboTask;
  created("task", task.id);
  await page.waitForFunction(() => document.querySelector(".task-quick-add")?.getAttribute("aria-busy") === "false");
  assert.equal(await quick.inputValue(), `${prefix}-next`);
  await page.unroute("**/api/space");
  const nextResponse = written(page, "task.create");
  await quick.press("Enter");
  created("task", ((await (await nextResponse).json()).result as BiboTask).id);
  await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="快速添加任务"]')?.value === "");
}

async function checkCalendar({ page, prefix, created }: PlanningCase, width: number) {
  await page.goto(`${base}/calendar`, { waitUntil: "networkidle" });
  const day = page.locator(".calendar-date:not(.is-outside) .calendar-date-select").nth(3);
  await day.dblclick({ position: { x: 10, y: 42 } });
  await page.getByRole("textbox", { name: "标题", exact: true }).waitFor();
  await checkEventTiming(page);
  const eventCreate = written(page, "event.create");
  await page.getByRole("textbox", { name: "标题", exact: true }).fill(`${prefix}-meeting`);
  await page.getByRole("textbox", { name: "标题", exact: true }).press("Enter");
  const event = (await (await eventCreate).json()).result as BiboEvent;
  created("event", event.id);
  assert.equal(new Date(event.endAt).getTime() - new Date(event.startAt).getTime(), 30 * 60_000);
  await page.locator(".event-editor").waitFor({ state: "hidden" });
    await page.getByRole("group", { name: "日程视图" }).getByRole("button", { name: "日", exact: true }).click();
    if (width < 600) assert.ok((await page.getByRole("button", { name: / 9:30 新建日程$/ }).boundingBox())!.height >= 44);
  await page.getByRole("button", { name: / 9:30 新建日程$/ }).click();
  assert.equal((await page.getByLabel("开始", { exact: true }).inputValue()).slice(-5), "09:30");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator(".ui-overlay--dialog").evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
    if (getComputedStyle(element).opacity !== "1") throw new Error("Calendar editor did not finish appearing");
  });
  const bounds = await page.locator(".ui-overlay--dialog").boundingBox();
  assert.ok(bounds && Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2, "Calendar dialog must be centered");
  await page.screenshot({ path: `/tmp/workspace-planning-${width}.png` });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}

async function checkDirectoryCollapse(page: Page) {
  await page.goto(`${base}/files`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "收起目录树", exact: true }).click();
  assert.equal(await page.locator(".bibo-file-tree").isVisible(), false);
  const editor = await page.locator(".bibo-file-workbench").boundingBox();
  const workspace = await page.locator(".bibo-files-layout").boundingBox();
  assert.ok(editor && workspace && Math.abs(editor.width - workspace.width) < 2, "Collapsed tree must leave no rail");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "展开目录树");
  await page.keyboard.press("Enter");
  await page.locator(".bibo-file-tree").waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "收起目录树");
}

async function checkEventTiming(page: Page) {
  const start = page.getByLabel("开始", { exact: true });
  const end = page.getByLabel("结束", { exact: true });
  assert.equal((await start.inputValue()).slice(-5), "09:00");
  const initial = await start.inputValue();
  await start.fill(`${initial.slice(0, 11)}11:30`);
  assert.equal((await end.inputValue()).slice(-5), "12:30");
  await page.getByRole("button", { name: "30 分钟", exact: true }).click();
  assert.equal((await end.inputValue()).slice(-5), "12:00");
  await end.fill(`${initial.slice(0, 11)}10:00`);
  await page.getByText("结束时间必须晚于开始时间。", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "保存日程", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "30 分钟", exact: true }).click();
}

async function check(width: number) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 600 });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const prefix = `planning-${crypto.randomUUID().slice(0, 8)}`;
  const owned: Array<{ kind: "task" | "event"; id: string }> = [];
  const api = async <T>(action: string, input: Record<string, unknown> = {}): Promise<T> => {
    const response = await context.request.post(`${base}/api/space`, { headers: { origin: base }, data: { action, input } });
    assert.equal(response.status(), 200, action);
    return (await response.json()).result;
  };
  try {
    if (base.startsWith("https:")) {
      const account = JSON.parse(readFileSync(`${homedir()}/.config/bibo-hosted/smoke-account.json`, "utf8"));
      const login = await context.request.post(`${base}/api/auth/login`, { headers: { origin: base }, data: { email: account.email, password: account.password } });
      assert.equal(login.status(), 200);
    }
    const fixture = { page, prefix, api, created: (kind: "task" | "event", id: string) => { owned.push({ kind, id }); } };
    await checkQuickTasks(fixture);
    await checkFailedTask(fixture);
    await checkPendingInput(fixture);
    await checkTaskDates(fixture);
    await checkRichTask(fixture);
    await page.screenshot({ path: `/tmp/workspace-planning-tasks-${width}.png` });
    await checkCalendar(fixture, width);
    await checkDirectoryCollapse(page);
    console.log(`Planning ${width}: continuous tasks, rich details, month double click, half-hour slot, duration and invalid time passed`);
  } catch (error) {
    await page.screenshot({ path: `/tmp/workspace-planning-failed-${width}.png`, animations: "disabled" });
    console.error("Planning failure focus", await page.evaluate(() => ({
      label: document.activeElement?.getAttribute("aria-label"),
      dialog: document.activeElement?.closest('[role="dialog"]')?.querySelector("h2")?.textContent,
    })));
    throw error;
  } finally {
    for (const item of owned) {
      const latest = await api<{ version: number }>(`${item.kind}.get`, { id: item.id });
      await api(`${item.kind}.delete`, { id: item.id, version: latest.version });
    }
    await context.close();
  }
}

try { if (server) await ready(); for (const width of [1440, 390, 320]) await check(width); }
finally { await browser.close(); if (server && server.exitCode === null) { const exited = once(server, "exit"); server.kill(); await exited; } }
