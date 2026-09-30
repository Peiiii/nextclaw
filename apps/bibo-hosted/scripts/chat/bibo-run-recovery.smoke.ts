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
      startedAt: Date.now(), updatedAt: Date.now(), partial: "已经完成第一步。\n\n正在处理第二步。",
      partialBlocks: [{ id: "first", text: "已经完成第一步。" }, { id: "second", text: "正在处理第二步。" }], activity: "exec" };
    let disconnected = false;
    let release!: () => void;
    let finished = new Promise<void>((resolve) => { release = resolve; });
    let subscriptions = 0;
    let posts = 0;
    page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/chat") posts++; });
    await page.route("**/api/runs**", async (route) => {
      if (disconnected) return route.abort("internetdisconnected");
      if (new URL(route.request().url()).pathname === "/api/runs") {
        return route.fulfill({ contentType: "application/json", body: JSON.stringify({ run, activeRuns: ["generating", "saving"].includes(run.phase) ? [run] : [] }) });
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
    const firstCard = page.getByText(run.partialBlocks![0].text, { exact: true });
    await firstCard.waitFor();
    await page.getByText(run.partialBlocks![1].text, { exact: true }).waitFor();
    const indicator = page.locator(".bibo-run-status");
    await page.locator('.bibo-run-status[data-state="working"]').waitFor();
    assert.equal(await indicator.count(), 1, "only one status indicator is mounted");
    assert.ok(await indicator.locator("svg").isVisible(), "status is a visible SVG");
    assert.equal(await indicator.evaluate((element) => {
      const anchor = element.closest(".sidebar-header, .bibo-topbar-context")!;
      const heading = anchor.querySelector(".bibo-brand, h1")!;
      const icon = element.getBoundingClientRect(), title = heading.getBoundingClientRect();
      return Math.abs(icon.y + icon.height / 2 - title.y - title.height / 2) < 2;
    }), true, "status shares the brand/title row");
    assert.equal(posts, 0, "fresh tab without pending storage attaches instead of resending");
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "停止生成", exact: true }).waitFor();
    assert.equal(await firstCard.count(), 1, "snapshot replaces partial without duplication");
    const node = (await page.locator(".ui-message--assistant").filter({ hasText: run.partialBlocks![0].text }).elementHandle())!;
    run = { ...run, activity: undefined };
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.locator('.bibo-run-status[data-state="thinking"]').waitFor();
    run = { ...run, phase: "saving" };
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.locator('.bibo-run-status[data-state="saving"]').waitFor();
    run = { ...run, phase: "generating", activity: "exec" };
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.locator('.bibo-run-status[data-state="working"]').waitFor();
    disconnected = true;
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await page.locator('.bibo-run-status[data-state="reconnecting"]').waitFor();
    assert.equal(await page.getByRole("button", { name: "发送消息", exact: true }).count(), 0, "unknown server state cannot expose send");
    disconnected = false;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.getByRole("button", { name: "停止生成", exact: true }).waitFor();
    await page.getByText(run.partialBlocks![1].text, { exact: true }).waitFor();
    assert.equal(await node.evaluate(element => element.isConnected), true, "reconnection preserves earlier card nodes and block boundaries");
    run = { ...run, phase: "completed", activity: undefined };
    release();
    await page.getByText("后台任务完整结果", { exact: true }).waitFor();
    await page.locator('.bibo-run-status[data-state="idle"]').waitFor();
    const statusIcon = indicator.getByRole("img", { name: "Bibo · 空闲", exact: true });
    if (!mobile) {
      await statusIcon.hover();
      await page.getByRole("tooltip", { name: "Bibo · 空闲" }).waitFor();
      await page.mouse.move(900, 800);
      await page.getByRole("tooltip").waitFor({ state: "hidden" });
      await page.keyboard.press("Tab");
      await statusIcon.focus();
      await page.getByRole("tooltip", { name: "Bibo · 空闲" }).waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
      assert.equal(await indicator.count(), 1);
      assert.ok(await indicator.isVisible(), "collapsed sidebar keeps the status accessible");
      await page.getByRole("button", { name: "展开侧边栏", exact: true }).click();
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await indicator.locator("svg").evaluate((element) => element.getAnimations({ subtree: true }).length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const theme of ["classic", "neutral"]) {
      await page.evaluate((value) => document.documentElement.dataset.biboTheme = value, theme);
      assert.ok(await indicator.isVisible());
      await page.screenshot({ path: `/tmp/bibo-status-${mobile ? "mobile" : "desktop"}-${theme}.png` });
    }
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
    let allowStop!: () => void;
    const stopPending = new Promise<void>((resolve) => { allowStop = resolve; });
    await page.route("**/api/cancel", async (route) => {
      assert.equal(route.request().postDataJSON().runId, run.runId);
      stops++;
      await stopPending;
      run = { ...run, phase: "failed", error: { code: "RUN_CANCELLED", message: "已停止这次任务。" } };
      await route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
      release();
    });
    await page.reload();
    if (mobile) await page.getByRole("button", { name: "打开菜单", exact: true }).click();
    await page.getByRole("link", { name: "任务", exact: true }).click();
    await indicator.getByRole("link", { name: /查看正在工作的会话/ }).click();
    await page.getByRole("button", { name: "停止生成", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/chat/session-a", "status returns to the background run");
    await page.getByRole("button", { name: "停止生成", exact: true }).click();
    await page.locator('.bibo-run-status[data-state="stopping"]').waitFor();
    allowStop();
    await page.getByText("已停止这次任务。", { exact: true }).waitFor();
    assert.equal(stops, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(JSON.stringify({ mobile, refresh: true, freshTab: true, reconnect: true, noRepeatPost: true, failureVisible: true, stopAfterRefresh: true, subscriptions }));
    await context.close();
  }
} finally { await browser.close(); server.kill("SIGTERM"); await once(server, "exit").catch(() => undefined); }
