import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page } from "playwright";

const base = process.env.BIBO_SMOKE_BASE ?? "http://127.0.0.1:5198";
const server = process.env.BIBO_SMOKE_BASE ? null : spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5198", "--strictPort"], {
  cwd: new URL("..", import.meta.url).pathname, stdio: "ignore",
});
const at = "2026-09-27T00:00:00.000Z";
const session = { id: "markdown", title: "Markdown 对话", createdAt: at, updatedAt: at, messageCount: 2 };
const source = "flowchart LR\n  A[提出] --> B[完成]";
const code = 'const result = "可复制";\nconsole.log(result);';
const answer = [
  "# 阅读检查", "正文 **重点** 与 `web_search`，注释[^中文]。", "",
  "- 普通圆点", "  - 二级圆点", "    - 三级圆点", "- [x] 完成", "- [ ] 待办", "",
  "7. 保留起始编号", "8. 下一项", "", "##### 五级标题", "###### 六级标题", "",
  "| 说明 | 结果 |", "| :--- | ---: |", "| 很长的中文说明".repeat(1) + "，可以换行".repeat(35) + " | 42 |", "",
  "公式 $E=mc^2$ 与 \\(x^2\\)。", "", "$$\\sum_{i=1}^{n} i$$", "", "\\[\\frac{1}{2}\\]", "",
  "```typescript", code, "```", "", "```mermaid", source, "```", "",
  "![图像](https://markdown.example/image.svg)", "", "[邮件](mailto:hello@example.com)", "",
  "[^中文]: 注释正文。", "", "<script>window.markdownUnsafe=true</script>",
].join("\n");
type Message = { role: "user" | "assistant"; text: string; at: string };
const initial: Message[] = [{ role: "user", text: "阅读验证", at }, { role: "assistant", text: answer, at }];

async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch { /* Preview is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Markdown chat preview did not start");
}

async function setup(page: Page, state: { messages: Message[] }): Promise<void> {
  await page.route("https://markdown.example/image.svg", (route) => route.fulfill({
    contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="320" height="120" fill="#42624a"/></svg>',
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const action = route.request().method() === "POST" ? route.request().postDataJSON().action : "";
    const value = path === "/api/auth/me" ? { user: { id: "markdown-test", email: "markdown@example.com" } }
      : path === "/api/sessions" ? { sessions: [session] }
        : path === "/api/history" ? { messages: state.messages }
          : action === "overview.get" ? { result: { inbox: [], tasks: [], events: [], notes: [], projects: [], counts: { unread: 0, activeTasks: 0 } } }
            : { result: { items: [], nextCursor: null } };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(value) });
  });
  await page.addInitScript({ content: String.raw`(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      if (!String(args[0]).endsWith("/api/chat")) return original(...args);
      const stream = new ReadableStream({
        start: (controller) => {
          document.documentElement.dataset.markdownStream = "ready";
          const receive = (event) => {
            const { name, value } = event.detail;
            controller.enqueue(new TextEncoder().encode("event: " + name + "\ndata: " + JSON.stringify(value) + "\n\n"));
            if (name === "committed") {
              window.removeEventListener("markdown-frame", receive);
              controller.close();
            }
          };
          window.addEventListener("markdown-frame", receive);
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    };
  })()` });
  await page.goto(`${base}/chat/markdown`);
}

async function frame(page: Page, name: string, value: unknown): Promise<void> {
  await page.evaluate(({ name, value }) => window.dispatchEvent(new CustomEvent("markdown-frame", { detail: { name, value } })), { name, value });
}

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const state = { messages: [...initial] };
      await setup(page, state);
      const reader = page.locator(".ui-message--assistant").first();
      await reader.locator("[data-chat-mermaid-diagram] svg").waitFor({ timeout: 15000 }).catch(async (error) => {
        console.error({ errors, content: await page.locator("body").innerText() });
        await page.screenshot({ path: "/tmp/bibo-markdown-chat-failure.png", fullPage: true });
        throw error;
      });
      assert.equal(await reader.locator("pre pre").count(), 0);
      assert.equal(await reader.locator(".katex").count(), 4);
      assert.equal(await reader.locator("ol").first().getAttribute("start"), "7");
      const geometry = await reader.evaluate((element) => ({
        markers: Array.from(element.querySelectorAll("ul")).map((list) => getComputedStyle(list).listStyleType),
        rightAligned: getComputedStyle(element.querySelector("td:last-child")!).textAlign,
        font: getComputedStyle(element.querySelector("h5")!).fontWeight,
        viewport: innerWidth, page: document.documentElement.scrollWidth,
        brokenTargets: Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).filter((link) => !document.getElementById(decodeURIComponent(link.hash.slice(1)))).length,
      }));
      assert.deepEqual(geometry.markers.slice(0, 3), ["disc", "circle", "square"]);
      assert.equal(geometry.rightAligned, "right");
      assert.ok(Number(geometry.font) >= 600);
      assert.ok(geometry.page <= geometry.viewport + 1);
      assert.equal(geometry.brokenTargets, 0, await reader.locator("[id], a").evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join(" ")));
      await reader.getByRole("button", { name: "复制代码", exact: true }).first().click();
      assert.equal((await page.evaluate(() => navigator.clipboard.readText())).trimEnd(), code);
      await reader.getByRole("button", { name: "展开图表", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await dialog.getByRole("button", { name: "放大", exact: true }).click();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      await reader.getByRole("button", { name: "展开图片", exact: true }).first().click();
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      const input = page.getByRole("textbox", { name: /告诉 Bibo/ });
      await page.locator(".bibo-messages").evaluate((element) => element.scrollTo({ top: 0 }));
      await reader.locator("h1").evaluate((node) => {
        Object.assign(window, { markdownHistoryNode: node });
        const selection = getSelection()!;
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges(); selection.addRange(range);
      });
      await input.fill("继续检查");
      await page.getByRole("button", { name: "发送消息", exact: true }).click();
      await page.waitForFunction(() => document.documentElement.dataset.markdownStream === "ready");
      await frame(page, "accepted", { runId: "markdown-run" });
      await page.locator(".bibo-messages").evaluate((element) => element.scrollTo({ top: 0 }));
      await page.getByRole("button", { name: "回到最新", exact: true }).waitFor();
      await reader.locator("h1").evaluate((node) => {
        const range = document.createRange(); range.selectNodeContents(node);
        const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range);
      });
      await frame(page, "delta", { text: answer });
      const pending = page.locator(".ui-message--assistant").last();
      await pending.locator("[data-chat-mermaid-diagram] svg").waitFor({ timeout: 15000 });
      await pending.evaluate((node) => Object.assign(window, { markdownPendingNode: node, markdownDiagramNode: node.querySelector("[data-chat-mermaid-diagram]") }));
      assert.ok(await reader.locator("h1").evaluate((node) => node === (window as unknown as { markdownHistoryNode: Element }).markdownHistoryNode));
      assert.equal(await page.evaluate(() => getSelection()?.toString()), "阅读检查");
      assert.equal(await page.locator(".bibo-messages").evaluate((element) => element.scrollTop), 0);
      await pending.getByRole("button", { name: "查看源码", exact: true }).click();
      state.messages = [...initial, { role: "user", text: "继续检查", at: "2026-09-27T00:01:00.000Z" }, { role: "assistant", text: answer, at: "2026-09-27T00:01:00.000Z" }];
      await frame(page, "committed", { messages: state.messages, session });
      await pending.getByRole("button", { name: "复制回答", exact: true }).waitFor();
      assert.ok(await pending.evaluate((node) => node === (window as unknown as { markdownPendingNode: Element }).markdownPendingNode), "saving preserves the message row");
      assert.ok(await pending.getByRole("button", { name: "查看图表", exact: true }).isVisible(), "saving preserves diagram source selection");
      const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
      assert.equal(ids.length, new Set(ids).size);
      await page.screenshot({ path: `/tmp/bibo-markdown-chat-${width}.png`, fullPage: true });
      await page.reload();
      await page.locator(".ui-message--assistant").last().getByRole("heading", { name: "阅读检查", exact: true }).waitFor();
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
} finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
}
