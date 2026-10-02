import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import type { BiboRunState } from "@nextclaw/bibo-client";

const origin = "https://app.bibo.bot";
const accountFile = process.env.BIBO_SMOKE_ACCOUNT_FILE ?? join(homedir(), ".config/bibo-hosted/smoke-account.json");
assert.equal(statSync(accountFile).mode & 0o077, 0, "Test credentials must be private");
const account = JSON.parse(readFileSync(accountFile, "utf8")) as { origin: string; email: string; password: string; userId: string };
assert.equal(account.origin, origin);
// Credentials only enter stdin and in-memory cookies, never process arguments or reports.
const login = spawnSync("curl", ["--silent", "--show-error", "--max-time", "30", "--include", "--header", "content-type: application/json",
  "--header", `origin: ${origin}`, "--data-binary", "@-", `${origin}/api/auth/login`], {
  input: JSON.stringify({ email: account.email, password: account.password }), encoding: "utf8",
});
assert.equal(login.status, 0, "Test login transport failed");
const boundary = login.stdout.lastIndexOf("\r\n\r\n");
assert.equal(JSON.parse(login.stdout.slice(boundary + 4)).user?.id, account.userId, "Unexpected test identity");
const token = login.stdout.slice(0, boundary).match(/set-cookie:\s*bibo_session=([^;\r\n]+)/i)?.[1];
assert.ok(token, "No test cookie");
const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const browser = await chromium.launch({ headless: true, proxy: proxyUrl ? { server: new URL(proxyUrl).origin } : undefined });
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
await context.addCookies([{ name: "bibo_session", value: token, domain: "app.bibo.bot", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors: string[] = [];
context.on("page", (page) => page.on("pageerror", error => errors.push(error.message)));
page.on("pageerror", error => errors.push(error.message));
let posts = 0;
context.on("request", request => { if (new URL(request.url()).pathname === "/api/chat" && request.method() === "POST") posts++; });
const marker = `run-refresh-smoke-${crypto.randomUUID().slice(0, 8)}`;
const path = `${marker}.md`;
const prompt = `请调用 bibo 工具执行 file.create，input 使用 ${JSON.stringify({ path, kind: "artifact", content: `# ${marker}\n\n刷新验证。` })}。然后调用 show_file，path 使用创建的文件路径，viewer=rendered。不要创建其他对象，也不要使用 shell。最后只回复“${marker} 完成”。`;
let sessionId: string | undefined;
let finished = false;
let releaseQuery: (() => void) | undefined;
async function api<T>(url: string, body?: unknown): Promise<T> {
  return page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, body === undefined ? undefined : {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Test API ${url.split("?")[0]}: ${response.status}`);
    return await response.json();
  }, { url, body });
}
try {
  await page.goto(`${origin}/chat`, { waitUntil: "networkidle" });
  const created = await api<{ session: { id: string } }>("/api/sessions", {});
  sessionId = created.session.id;
  await page.goto(`${origin}/chat/${sessionId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "发送消息", exact: true }).waitFor();
  await page.getByRole("textbox", { name: /告诉 Bibo/ }).fill(prompt);
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await page.getByRole("button", { name: "停止生成", exact: true }).waitFor();
  const initial = await api<BiboRunState>(`/api/runs?sessionId=${sessionId}`);
  assert.equal(initial.run?.phase, "generating", "Reload must start during a real active execution");
  const runId = initial.run.runId;
  assert.ok(await page.evaluate(id => sessionStorage.getItem(`bibo-pending-${id}`), account.userId), "Input receipt exists before reload");
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${origin}/chat/${sessionId}`);
  await mobile.waitForFunction(() => !document.querySelector('.bibo-run-status[data-state="checking"]'));
  assert.equal(await mobile.getByText(/上次生成中断|内容未保存/).count(), 0);
  assert.equal(await mobile.evaluate(id => sessionStorage.getItem(`bibo-pending-${id}`), account.userId), null, "Fresh page needs no local receipt");
  let queried!: () => void;
  const queryStarted = new Promise<void>(resolve => { queried = resolve; });
  const gate = new Promise<void>(resolve => { releaseQuery = resolve; });
  await page.route("**/api/runs?*", async route => { queried(); await gate; await route.continue(); });
  await page.reload();
  await queryStarted;
  await page.getByRole("img", { name: "Bibo · 正在查询状态", exact: true }).first().waitFor();
  assert.equal(await page.getByText(/上次生成中断|内容未保存/).count(), 0);
  assert.equal(await page.getByRole("textbox", { name: /告诉 Bibo/ }).inputValue(), "");
  assert.equal(await page.getByRole("button", { name: "发送消息", exact: true }).count(), 0);
  releaseQuery!();
  await page.waitForFunction(async id => {
    const response = await fetch(`/api/runs?sessionId=${id}`);
    if (!response.ok) throw new Error(`Run query: ${response.status}`);
    const state = await response.json();
    if (state.run?.phase === "failed") throw new Error(`Real execution failed: ${state.run.error?.code}`);
    return state.run?.phase === "completed";
  }, sessionId, { timeout: 300000, polling: 1000 });
  finished = true;
  await page.getByRole("button", { name: "发送消息", exact: true }).waitFor();
  await mobile.getByRole("button", { name: "发送消息", exact: true }).waitFor();
  const terminal = await api<BiboRunState>(`/api/runs?sessionId=${sessionId}`);
  assert.equal(terminal.run?.runId, runId, "Refresh observes the same server task");
  const history = await api<{ messages: Array<{ role: string; text: string }> }>(`/api/history?sessionId=${sessionId}`);
  assert.equal(history.messages.filter(message => message.role === "user" && message.text === prompt).length, 1);
  assert.ok(history.messages.some(message => message.role === "assistant" && message.text.includes(marker)));
  assert.equal(await page.evaluate(id => sessionStorage.getItem(`bibo-pending-${id}`), account.userId), null);
  const workspace = page.getByRole("complementary", { name: "右侧工作区" });
  await workspace.getByRole("heading", { name: path, exact: true }).waitFor();
  for (const target of [page, mobile]) {
    await target.reload({ waitUntil: "networkidle" });
    await target.getByRole("button", { name: "发送消息", exact: true }).waitFor();
    assert.equal(await target.getByText(/上次生成中断|内容未保存/).count(), 0);
    assert.equal(await target.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  assert.deepEqual(await api(`/api/history?sessionId=${sessionId}`), history, "Terminal reload does not duplicate saved messages");
  assert.equal(posts, 1, "Desktop refresh and fresh mobile page never repeat POST chat");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/bibo-run-refresh-live-desktop.png" });
  await mobile.screenshot({ path: "/tmp/bibo-run-refresh-live-mobile.png" });
  console.log(JSON.stringify({ ok: true, realModel: true, activeRefresh: true, delayedAuthority: true,
    freshMobilePage: true, sameRun: true, posts, savedOnce: true, contentOpening: true, terminalReload: true }));
} finally {
  releaseQuery?.();
  try {
    if (sessionId && !finished) {
      const state = await api<BiboRunState>(`/api/runs?sessionId=${sessionId}`);
      if (state.run?.phase === "generating") await api("/api/cancel", { runId: state.run.runId });
    }
    const files = await api<{ result: { items: Array<{ id: string; path: string; version: string }> } }>("/api/space", { action: "file.list", input: { query: path } });
    for (const file of files.result.items.filter(file => file.path === path)) await api("/api/space", { action: "file.delete", input: { id: file.id, version: file.version } });
    if (sessionId) await api("/api/sessions/delete", { id: sessionId });
  } finally { await browser.close(); }
}
