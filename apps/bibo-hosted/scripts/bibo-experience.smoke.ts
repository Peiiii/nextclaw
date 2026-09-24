import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5189";
const server = spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5189", "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });

async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch { /* Preview is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Bibo preview did not start");
}

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      page.on("pageerror", (error) => { process.stderr.write(`browser: ${error.message}\n`); });
      await page.addInitScript({ content: "window.__name = (value) => value;" });
      await page.addInitScript(() => {
        const originalFetch = window.fetch.bind(window);
        let history = JSON.parse(sessionStorage.getItem("__bibo_mock_history") || "null") as Array<{ role: string; text: string; at: string }> | null;
        history ??= Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: index % 2 ? `# 回答 ${index}\n\n- 内容一\n- 内容二\n\n\`code\`` : `问题 ${index}`, at: String(index) }));
        window.fetch = async (input, init) => {
          const url = String(input);
          const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
          if (url.endsWith("/api/auth/me")) return json({ user: { id: "smoke", email: "smoke@example.com" } });
          if (url.endsWith("/api/history")) return json({ messages: history });
          if (url.endsWith("/api/chat")) {
            const message = JSON.parse(String(init?.body)).message as string;
            const encoder = new TextEncoder();
            const events: Array<[string, unknown]> = message === "失败验收" ? [
              ["accepted", { runId: "failed-run" }],
              ["delta", { text: "这段只是临时内容" }],
              ["error", { error: "结果未能保存，请重试。" }],
            ] : [
              ["accepted", { runId: "smoke-run" }],
              ["delta", { text: "第一段。" }],
              ["delta", { text: "第二段。" }],
              ["saving", {}],
              ["committed", { text: "第一段。第二段。", messages: [...history!, { role: "user", text: message, at: "sent" }, { role: "assistant", text: "第一段。第二段。", at: "saved" }] }],
            ];
            let index = 0;
            return new Response(new ReadableStream({ start: (controller) => {
              const next = () => {
                if (index === events.length) { controller.close(); return; }
                const [name, value] = events[index++];
                if (name === "committed") { history = (value as { messages: typeof history }).messages; sessionStorage.setItem("__bibo_mock_history", JSON.stringify(history)); }
                controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`));
                setTimeout(next, 180);
              };
              next();
            } }), { headers: { "content-type": "text/event-stream" } });
          }
          return originalFetch(input, init);
        };
      });
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(".bibo-message").first().waitFor();
      const layout = await page.evaluate(() => ({ body: document.body.scrollHeight, viewport: innerHeight,
        composer: document.querySelector(".bibo-composer")!.getBoundingClientRect().bottom,
        list: document.querySelector(".bibo-messages")!.clientHeight,
        content: document.querySelector(".bibo-messages")!.scrollHeight }));
      assert.equal(layout.body, layout.viewport, "document must not scroll");
      assert.ok(layout.composer <= layout.viewport, "composer must stay visible");
      assert.ok(layout.content > layout.list, "long history scrolls inside message list");
      await page.locator("textarea").fill("流式验收");
      await page.getByRole("button", { name: "发送消息" }).click();
      await page.getByText("第一段。", { exact: true }).waitFor();
      assert.equal(await page.locator(".bibo-message--pending").count(), 2, "delta must display before commit");
      await page.locator(".bibo-messages").evaluate((element) => { element.scrollTo({ top: 0 }); });
      await page.getByRole("button", { name: "回到最新 ↓" }).waitFor();
      await page.getByText("第一段。第二段。", { exact: true }).waitFor();
      assert.ok((await page.locator(".bibo-messages").evaluate((element) => element.scrollTop)) < 50, "stream must not steal reading position");
      await page.getByRole("button", { name: "回到最新 ↓" }).click();
      await page.locator(".bibo-message--pending").first().waitFor({ state: "detached" });
      assert.equal(await page.locator(".bibo-message").count(), 32, "committed pair enters history");
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.locator(".bibo-message").count(), 32, "refresh restores committed history");
      await page.locator("textarea").fill("失败验收");
      await page.getByRole("button", { name: "发送消息" }).click();
      await page.getByText("这段只是临时内容", { exact: true }).waitFor();
      await page.locator(".bibo-message--pending").first().waitFor({ state: "detached" });
      assert.equal(await page.locator("textarea").inputValue(), "失败验收", "unsaved input must be ready to retry");
      assert.equal(await page.locator(".bibo-message").count(), 32, "unsaved answer must not enter history");
      await page.close();
    }
  } finally { await browser.close(); }
} finally {
  server.kill("SIGTERM");
  await once(server, "exit");
}
