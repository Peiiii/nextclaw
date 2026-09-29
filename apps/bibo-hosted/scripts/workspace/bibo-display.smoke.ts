import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";
import { mockApi } from "../personal-workspace.fixture";

const origin = "http://127.0.0.1:5395";
const server = spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5395", "--strictPort"], { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
const frame = (name: string, value: unknown) => `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* Starting isolated preview. */ }
    if (attempt === 59) throw new Error("Display preview did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await mockApi(page);
      const detail = { id: "display-file", path: "report.html", kind: "artifact", content: "<h1>自动打开的文件</h1>", uri: "nextclaw://objects/file/display-file", version: "opaque-r2-etag", createdAt: "now", updatedAt: "now" };
      let reads = 0;
      let largePreview = false;
      await page.route("**/api/space", async (route) => {
        const body = route.request().postDataJSON();
        if (body.action === "file.get" && (body.input.path === detail.path || body.input.id === detail.id)) {
          if (body.input.path) reads++;
          return route.fulfill({ json: { result: largePreview ? { ...detail,
            preview: { totalBytes: 100 * 1024 * 1024, readBytes: 32, truncated: true, binary: false } } : detail } });
        }
        await route.fallback();
      });
      let viewer = "rendered";
      let fail = false;
      let show = true;
      let index = 0;
      let savedMessages: Array<{ role: string; text: string; at: string }> = [];
      await page.route("**/api/history?*", (route) => route.fulfill({ json: { messages: savedMessages } }));
      await page.route("**/api/chat", (route) => {
        const value = { id: "same-event", sessionId: "session-a", target: { type: "file", payload: { path: detail.path, viewer } } };
        const messages = [{ role: "assistant", text: `[产物](${detail.uri}) 回答 ${++index}`, at: String(index) }];
        if (!fail) savedMessages = messages;
        return route.fulfill({ contentType: "text/event-stream", body: frame("accepted", { runId: "r1" }) + frame("delta", { text: "正在处理" })
          + (show ? frame("show-content", value) + frame("show-content", value) : "")
          + (fail ? frame("error", { error: "结果未能保存" }) : frame("saving", {}) + frame("committed", { text: messages[0]!.text, messages })) });
      });
      const send = async () => {
        if (viewport.width < 600 && await page.getByRole("complementary", { name: "右侧工作区" }).count()) {
          await page.getByRole("button", { name: "关闭工作区" }).click();
        }
        await page.getByRole("textbox", { name: /告诉 Bibo/ }).fill("打开文档");
        await page.getByRole("button", { name: "发送消息", exact: true }).click();
        await page.getByRole("button", { name: "发送消息", exact: true }).waitFor();
      };
      await page.goto(`${origin}/chat/session-a`, { waitUntil: "networkidle" });
      await send();
      const workspace = page.getByRole("complementary", { name: "右侧工作区" });
      await workspace.frameLocator("iframe").getByRole("heading", { name: "自动打开的文件" }).waitFor();
      assert.equal(reads, 1, "duplicate requests open once");
      const iframe = await workspace.locator("iframe").elementHandle();
      show = false;
      await send();
      if (viewport.width >= 600) assert.ok(await iframe!.evaluate((node) => node.isConnected), "later replies preserve the preview DOM");
      else assert.equal(await workspace.count(), 0, "later replies respect a closed mobile workspace");
      viewer = "source"; show = true;
      await send();
      assert.equal(await workspace.getByRole("textbox", { name: "编辑 report.html" }).textContent(), detail.content);
      await page.getByRole("button", { name: "关闭工作区" }).click();
      fail = true;
      await send();
      await page.getByText(/结果未能保存/).waitFor();
      assert.equal(await workspace.count(), 0, "unsaved displays never open");
      await page.locator('.ui-markdown a[href="/files/display-file"]').click();
      await workspace.frameLocator("iframe").getByRole("heading", { name: "自动打开的文件" }).waitFor();
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, closeVisible: !!document.querySelector('.bibo-workspace-head button') }));
      assert.equal(layout.overflow, false);
      assert.equal(layout.closeVisible, true);
      await page.screenshot({ path: `/tmp/bibo-display-${viewport.width}.png`, fullPage: true });
      await page.reload({ waitUntil: "networkidle" });
      await workspace.frameLocator("iframe").getByRole("heading", { name: "自动打开的文件" }).waitFor();
      largePreview = true;
      await page.reload({ waitUntil: "networkidle" });
      await workspace.getByText(/当前仅显示部分内容/).waitFor();
      assert.equal(await workspace.locator(".bibo-file-editor-surface").count(), 0);
      assert.equal(await workspace.getByRole("button", { name: "编辑", exact: true }).count(), 0);
      assert.equal(await workspace.getByRole("link", { name: "下载原文件" }).getAttribute("href"), "/api/workspace/file?path=report.html");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `/tmp/bibo-file-preview-${viewport.width}.png`, fullPage: true });
      assert.deepEqual(errors, [], "browser has no runtime errors");
      await context.close();
    }
    console.log(JSON.stringify({ ok: true, desktop: true, mobile: true, automatic: true, source: true, saveFailure: true, identity: true, refresh: true }));
  } finally { await browser.close(); }
} finally {
  const exited = once(server, "exit"); server.kill(); await exited;
}
