import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";
import type { BiboRunSnapshot } from "@nextclaw/bibo-client";
import { mockApi } from "../personal-workspace.fixture";

const port = String(32000 + process.pid % 20000);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [new URL("../../node_modules/vite/bin/vite.js", import.meta.url).pathname,
  "preview", "--host", "127.0.0.1", "--port", port, "--strictPort"], { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
const browser = await chromium.launch();
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base)).ok) break; } catch { /* Starting the isolated preview. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1360, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    await mockApi(page);
    let run: BiboRunSnapshot = { runId: "run-restored", sessionId: "session-a", message: "后台任务的输入", phase: "generating",
      startedAt: Date.now(), updatedAt: Date.now(), partial: "已经完成第一步。", activity: "exec", clientRequestId: "recovery-request" };
    let disconnected = false;
    let release!: () => void;
    let finished = new Promise<void>((resolve) => { release = resolve; });
    let subscriptions = 0;
    let posts = 0;
    let queryGate: Promise<void> | undefined;
    let releaseQuery!: () => void;
    let queried!: () => void;
    page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/chat") posts++; });
    await page.route("**/api/runs**", async (route) => {
      if (disconnected) return route.abort("internetdisconnected");
      if (new URL(route.request().url()).pathname === "/api/runs") {
        queried?.();
        await queryGate;
        return route.fulfill({ contentType: "application/json", body: JSON.stringify({ run, activeRuns: run.phase === "generating" ? [run] : [] }) });
      }
      subscriptions++;
      await finished;
      const frames = `event: snapshot\ndata: ${JSON.stringify(run)}\n\n` + (run.phase === "failed"
        ? `event: error\ndata: ${JSON.stringify({ error: run.error!.message, code: run.error!.code })}\n\n`
        : `event: committed\ndata: ${JSON.stringify({ text: "后台任务完整结果", messages: [
          { role: "user", text: run.message, at: new Date(run.startedAt).toISOString() },
          { role: "assistant", text: "后台任务完整结果", at: new Date().toISOString() }],
          session: { id: run.sessionId, title: "后台任务", updatedAt: new Date().toISOString() } })}\n\n`);
      await route.fulfill({ contentType: "text/event-stream", body: frames }).catch(() => undefined);
    });
    await page.goto(`${base}/chat/session-a`);
    await page.getByRole("button", { name: "停止生成", exact: true }).waitFor();
    await page.getByText(run.partial, { exact: true }).waitFor();
    assert.equal(posts, 0, "fresh tab without pending storage attaches instead of resending");
    await page.evaluate((run) => sessionStorage.setItem("bibo-pending-smoke", JSON.stringify({
      message: run.message, sessionId: run.sessionId, clientRequestId: run.clientRequestId,
    })), run);
    queryGate = new Promise<void>((resolve) => { releaseQuery = resolve; });
    const queryStarted = new Promise<void>((resolve) => { queried = resolve; });
    await page.reload();
    await queryStarted;
    await page.getByText("Bibo · 正在查询状态", { exact: true }).first().waitFor();
    assert.equal(await page.getByText(/上次生成中断|内容未保存/).count(), 0, "receipt must not be treated as failure before authority returns");
    assert.equal(await page.locator("textarea").inputValue(), "", "active input must not be restored as a failed draft");
    assert.equal(await page.getByRole("button", { name: "发送消息", exact: true }).count(), 0);
    releaseQuery();
    queryGate = undefined;
    await page.getByRole("button", { name: "停止生成", exact: true }).waitFor();
    assert.equal(await page.getByText(run.partial, { exact: true }).count(), 1, "snapshot replaces partial without duplication");
    disconnected = true;
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await page.getByText("连接中断 · 正在重新连接", { exact: true }).first().waitFor();
    assert.equal(await page.getByRole("button", { name: "发送消息", exact: true }).count(), 0, "unknown server state cannot expose send");
    disconnected = false;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.getByRole("button", { name: "停止生成", exact: true }).waitFor();
    await page.locator("textarea").fill("下一条独立草稿");
    run = { ...run, phase: "completed", activity: undefined };
    release();
    await page.getByText("后台任务完整结果", { exact: true }).waitFor();
    await page.getByText("Bibo · 空闲", { exact: true }).first().waitFor();
    assert.equal(await page.locator("textarea").inputValue(), "下一条独立草稿", "commit must preserve the user's later draft");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("bibo-pending-smoke")), null);
    await page.reload();
    await page.getByText("后台任务完整结果", { exact: true }).waitFor();
    assert.equal(posts, 0);
    assert.ok(subscriptions >= 3);
    // A server failure survives another reload and is visible with its actual reason.
    run = { ...run, phase: "failed", error: { code: "RUN_INTERRUPTED", message: "服务发生中断，这次任务未能完成。" } };
    finished = Promise.resolve();
    await page.reload();
    await page.getByText(run.error!.message, { exact: true }).waitFor();
    run = { ...run, runId: "cancel-after-refresh", phase: "generating", error: undefined };
    finished = new Promise<void>((resolve) => { release = resolve; });
    let stops = 0;
    await page.route("**/api/cancel", async (route) => {
      assert.equal(route.request().postDataJSON().runId, run.runId);
      stops++;
      run = { ...run, phase: "failed", error: { code: "RUN_CANCELLED", message: "已停止这次任务。" } };
      await route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
      release();
    });
    await page.reload();
    await page.getByRole("button", { name: "停止生成", exact: true }).click();
    await page.getByText("已停止这次任务。", { exact: true }).waitFor();
    assert.equal(stops, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(JSON.stringify({ mobile, refreshWithReceipt: true, delayedAuthorityNoFalseFailure: true, freshTab: true, reconnect: true, noRepeatPost: true, failureVisible: true, stopAfterRefresh: true, subscriptions }));
    await context.close();
  }
} finally { await browser.close(); server.kill("SIGTERM"); await once(server, "exit").catch(() => undefined); }
