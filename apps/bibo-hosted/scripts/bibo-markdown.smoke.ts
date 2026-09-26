import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page } from "playwright";

const base = "http://127.0.0.1:5190";
const server = spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5190", "--strictPort"], {
  cwd: new URL("..", import.meta.url).pathname,
  stdio: "ignore",
});
const longCode = `const content = "${"一段需要横向滚动的代码".repeat(24)}";`;
const body = [
  "# 本周决策摘要",
  "第一段说明，包含 **重点**、*强调*、~~旧结论~~ 和 `inline()`。",
  "",
  "第二段说明。[参考资料](https://example.com) 与 [本地链接](./private.md) 同时出现。",
  "",
  "## 下一步",
  "- [x] 已核对事实",
  "- [ ] 等待你的决定",
  "  - 子项需要保持层级",
  "1. 先阅读摘要",
  "2. 再决定方案",
  "",
  "> 引用内容可以分两行，保留清楚的层级。",
  "",
  "### 对比表",
  "| 方案 | 条件 | 成本 | 时间 | 风险 | 备注 |",
  "| --- | --- | --- | --- | --- | --- |",
  "| A | 需要人工确认 | 中等 | 下周三 | 中等 | 此列专门检验窄屏表格横向滚动 |",
  "",
  "```typescript",
  longCode,
  "```",
  "",
  "公式 $E=mc^2$，以及独立公式：",
  "",
  "$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$",
  "",
  "```mermaid",
  "flowchart LR",
  "  A[提出] --> B[确认]",
  "```",
  "",
  "![不可加载的图片](data:image/svg+xml;base64,PHN2Zz4=)",
  "",
  "---",
  "最后一段总结。",
].join("\n");

async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch { /* Preview is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Bibo Markdown preview did not start");
}

async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const action = request.method() === "POST" ? String((request.postDataJSON() as { action?: string }).action) : "";
    const result = path === "/api/auth/me"
      ? { user: { id: "markdown-smoke", email: "markdown@example.com" } }
      : path === "/api/sessions"
        ? { sessions: [] }
        : action === "inbox.list"
          ? { result: { items: [{ id: "markdown-inbox", kind: "decision", title: "Markdown 阅读验证", body, source: { kind: "bibo" }, createdAt: "2026-09-25T09:00:00.000Z", readAt: null, resolvedAt: null, version: 1 }], nextCursor: null } }
          : { result: { items: [], nextCursor: null } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
}

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 760, permissions: ["clipboard-read", "clipboard-write"] });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await mockApi(page);
      await page.goto(`${base}/inbox`);
      await page.getByRole("button", { name: /Markdown 阅读验证/ }).click();
      assert.match(await page.locator(".bibo-list-pane .ui-list-row small").first().innerText(), /第一段说明，包含 重点、强调、旧结论 和 inline\(\)/);
      const reader = page.locator(".bibo-readable .ui-markdown");
      await reader.getByRole("heading", { name: "本周决策摘要" }).waitFor();
      assert.equal(await reader.locator("h2, h3").count(), 2);
      assert.equal(await reader.locator("input[type=checkbox]").count(), 2);
      assert.equal(await reader.locator("blockquote").count(), 1);
      assert.equal(await reader.locator("table").count(), 1);
      assert.ok(await reader.locator(".katex").count() > 0);
      assert.equal(await reader.locator("a").count(), 1, "unresolved local links must not navigate");
      assert.equal(await reader.locator(".ui-markdown__image-fallback").count(), 1);
      await reader.getByRole("img", { name: "Mermaid 图表" }).waitFor({ timeout: 15000 });
      const geometry = await page.evaluate(() => {
        const reader = document.querySelector(".bibo-readable .ui-markdown")!;
        const paragraphs = reader.querySelectorAll("p");
        const first = paragraphs[0]!.getBoundingClientRect();
        const second = paragraphs[1]!.getBoundingClientRect();
        const table = reader.querySelector(".ui-message__table")!;
        const blocks = Array.from(reader.children);
        const code = reader.querySelector(".ui-code-block pre")!;
        return {
          whiteSpace: getComputedStyle(reader).whiteSpace,
          paragraphGap: second.top - first.bottom,
          pageWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          tableScrollable: table.scrollWidth > table.clientWidth,
          codeScrollable: code.scrollWidth > code.clientWidth,
          blockGaps: blocks.slice(1).map((element, index) => element.getBoundingClientRect().top - blocks[index]!.getBoundingClientRect().bottom),
        };
      });
      assert.equal(geometry.whiteSpace, "normal");
      assert.ok(geometry.paragraphGap >= 0 && geometry.paragraphGap <= 16, `paragraph gap: ${geometry.paragraphGap}`);
      assert.ok(geometry.pageWidth <= geometry.viewport + 1, `page overflow at ${width}px`);
      if (width < 760) assert.ok(geometry.tableScrollable, `table should scroll within reader at ${width}px`);
      assert.ok(geometry.codeScrollable, `code should scroll within reader at ${width}px`);
      assert.ok(geometry.blockGaps.every((gap) => gap >= 0 && gap <= 30), `inconsistent block spacing at ${width}px: ${geometry.blockGaps}`);
      await page.screenshot({ path: `/tmp/bibo-markdown-inbox-${width}.png`, fullPage: true });
      await reader.getByRole("button", { name: "复制代码" }).first().click();
      assert.equal((await page.evaluate(() => navigator.clipboard.readText())).trimEnd(), longCode);
      const resolve = page.getByRole("button", { name: "已处理" });
      await resolve.scrollIntoViewIfNeeded();
      assert.ok(await resolve.isVisible(), `inbox actions should remain reachable at ${width}px`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
} finally {
  if (server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
}
