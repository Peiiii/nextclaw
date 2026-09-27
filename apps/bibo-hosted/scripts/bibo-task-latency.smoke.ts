import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import type { BiboTask } from "@nextclaw/bibo-client";
import { mockApi } from "./personal-workspace.fixture";

const local = process.env.BIBO_TASK_SMOKE_LOCAL === "1";
const origin = local ? "http://127.0.0.1:5189" : "https://app.bibo.bot";
const marker = `task-latency-${Date.now()}`;

// Credentials stay on stdin and in memory, never in argv, reports or screenshots.
async function login(): Promise<string> {
  const accountFile = process.env.BIBO_SMOKE_ACCOUNT_FILE ?? join(homedir(), ".config/bibo-hosted/smoke-account.json");
  assert.equal(statSync(accountFile).mode & 0o077, 0, "Smoke credentials must be owner-only");
  const account = JSON.parse(readFileSync(accountFile, "utf8")) as { origin: string; email: string; password: string; userId: string };
  assert.equal(account.origin, origin);
  const child = spawn("curl", ["--silent", "--show-error", "--max-time", "30", "--suppress-connect-headers", "--config", "-"], { stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.resume();
  child.stdin.end([
    `url = ${JSON.stringify(`${origin}/api/auth/login`)}`, "include",
    `header = ${JSON.stringify(`origin: ${origin}`)}`, 'header = "content-type: application/json"',
    `data = ${JSON.stringify(JSON.stringify({ email: account.email, password: account.password }))}`,
  ].join("\n"));
  const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  assert.equal(code, 0, "Login transport failed");
  const boundary = output.lastIndexOf("\r\n\r\n");
  const headers = output.slice(0, boundary);
  assert.equal(JSON.parse(output.slice(boundary + 4)).user?.id, account.userId, "Wrong smoke identity");
  const token = headers.match(/set-cookie:\s*bibo_session=([^;\r\n]+)/i)?.[1];
  assert.ok(token, "Login session missing");
  return token;
}

function proxy() {
  const source = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (!source) return undefined;
  const url = new URL(source);
  return { server: `${url.protocol}//${url.host}`, ...(url.username ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } : {}) };
}

async function space<T>(page: Page, action: string, input: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(async ({ action, input }) => {
    const response = await fetch("/api/space", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, input }) });
    if (!response.ok) throw new Error(`${action} returned ${response.status}`);
    return (await response.json()).result;
  }, { action, input });
}

const summarize = (samples: number[]) => {
  const ordered = [...samples].sort((a, b) => a - b);
  return { count: samples.length, p50: ordered[Math.ceil(ordered.length * .5) - 1], p95: ordered[Math.ceil(ordered.length * .95) - 1], max: ordered.at(-1) };
};

async function checkFailedDraft(page: Page, input: Locator): Promise<void> {
    let failed = false;
    await page.route("**/api/space", async (route) => {
      if (route.request().postDataJSON().action === "task.create" && !failed) {
        failed = true;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "保存失败，请重试。" }) });
      } else await route.fallback();
    });
    await input.fill("失败后保留的草稿");
    await input.press("Enter");
    await page.getByText("保存失败，请重试。", { exact: true }).first().waitFor();
    assert.equal(await input.inputValue(), "失败后保留的草稿");
    await input.press("Enter");
    await page.locator(".bibo-task-row").filter({ hasText: "失败后保留的草稿" }).waitFor();
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="快速添加任务"]')?.value === "");
}

async function saveSample(page: Page, input: Locator, title: string) {
  await input.fill(title);
  const response = page.waitForResponse((response) => response.url().endsWith("/api/space") && response.request().postDataJSON()?.action === "task.create");
  const started = performance.now();
  await input.press("Enter");
  const saved = await response;
  assert.equal(saved.status(), 200);
  await page.locator(".bibo-task-row").filter({ hasText: title }).waitFor();
  await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="快速添加任务"]')?.value === "" && document.querySelector(".task-quick-add")?.getAttribute("aria-busy") === "false");
  const elapsed = Math.round(performance.now() - started);
  const timing = saved.request().timing();
  return { elapsed, span: saved.headers()["server-timing"] ?? "", request: Math.round(timing.responseEnd - timing.requestStart) };
}

async function measure(context: BrowserContext, width: number) {
  const page = await context.newPage();
  if (local) await mockApi(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/tasks`, { waitUntil: "domcontentloaded" });
  const input = page.getByRole("textbox", { name: "快速添加任务", exact: true });
  await input.waitFor();
  await page.getByRole("status", { name: "正在加载页面" }).waitFor({ state: "hidden" });
  await page.waitForLoadState("networkidle");
  if (local) await checkFailedDraft(page, input);
  const samples: number[] = [];
  const spans: string[] = [];
  const requestMs: number[] = [];
  for (let index = 0; index < 20; index += 1) {
    const sample = await saveSample(page, input, `${marker}-${width}-${index}`);
    samples.push(sample.elapsed);
    spans.push(sample.span);
    requestMs.push(sample.request);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".bibo-task-row").filter({ hasText: `${marker}-${width}-19` }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ viewport: width, savedUiMs: summarize(samples), samples, requestMs, serverTiming: spans, refreshed: true }));
  return { page, p95: summarize(samples).p95! };
}

const preview = local ? spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5189", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }) : null;
if (preview) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(origin)).ok) break; } catch { /* Starting preview. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
const token = local ? "local" : await login();
const browser = await chromium.launch({ headless: true, proxy: local ? undefined : proxy() });
const contexts: BrowserContext[] = [];
let cleanupPage: Page | undefined;
const results: Array<{ viewport: number; p95: number }> = [];
try {
  for (const width of [1365, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
    contexts.push(context);
    await context.addCookies([{ name: "bibo_session", value: token, domain: "app.bibo.bot", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
    if (!local) {
      cleanupPage = await context.newPage();
      await cleanupPage.goto(`${origin}/tasks`, { waitUntil: "domcontentloaded" });
    }
    const result = await measure(context, width);
    results.push({ viewport: width, p95: result.p95 });
  }
  assert.ok(results.every((result) => result.p95 <= 1000), `Saved UI P95 exceeded 1000ms: ${JSON.stringify(results)}`);
} finally {
  try {
    if (cleanupPage) {
      const tasks = await space<{ items: BiboTask[] }>(cleanupPage, "task.list", { query: marker, limit: 100 });
      for (const task of tasks.items.filter((task) => task.title.startsWith(marker))) await space(cleanupPage, "task.delete", { id: task.id, version: task.version });
      console.log(JSON.stringify({ cleanup: true, deleted: tasks.items.length }));
    }
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
    preview?.kill("SIGTERM");
  }
}
