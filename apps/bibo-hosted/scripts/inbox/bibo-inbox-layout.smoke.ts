import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page } from "playwright";
import type { BiboInboxItem } from "@nextclaw/bibo-client";
import { inboxReadingBody } from "../../src/features/space/utils/inbox-content.utils";
import { inboxTime } from "../../src/features/space/utils/date-format.utils";

const base = process.env.BIBO_SMOKE_BASE ?? "http://127.0.0.1:5192";
const server = process.env.BIBO_SMOKE_BASE ? null : spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "5192", "--strictPort"], { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
const title = "今日新闻简报 · 2026年9月26日";
const body = `# ${title}\n\n> 来源：今日新闻汇总\n\n` + Array.from({ length: 12 }, (_, index) => `## ${index === 0 ? "头条要闻" : `专题 ${index}`}\n\n这一节汇总值得关注的事项。\n\n- 阅读重要进展\n- 核对消息来源\n- 记录下一步关注的事项`).join("\n\n");
const clockNow = new Date(2026, 8, 26, 9, 20);
for (const [date, expected] of [
  [new Date(2026, 8, 26, 9, 19, 30), "刚刚"],
  [new Date(2026, 8, 26, 9, 19), "1分钟前"],
  [new Date(2026, 8, 26, 8, 20), "1小时前"],
  [new Date(2026, 8, 25, 23, 59), "昨天"],
  [new Date(2026, 8, 24), "星期四"],
  [new Date(2026, 8, 19), "9/19"],
  [new Date(2025, 11, 31), "2025/12/31"],
  [new Date(2026, 8, 27), "9/27"],
] as const) assert.equal(inboxTime(date.toISOString(), clockNow.getTime()), expected);
assert.equal(inboxTime(new Date(2026, 8, 25, 23, 59).toISOString(), new Date(2026, 8, 26, 0, 1).getTime()), "昨天", "yesterday follows the local calendar boundary");

for (const [input, expected] of [
  [`# ${title}\n正文`, "正文"],
  [`\r\n  ## ${title} ##\r\n正文`, "正文"],
  ["# 不同标题\n正文", "# 不同标题\n正文"],
  [`前言\n# ${title}`, `前言\n# ${title}`],
  [`\`\`\`\n# ${title}\n\`\`\``, `\`\`\`\n# ${title}\n\`\`\``],
  [`### ${title}\n章节`, `### ${title}\n章节`],
  [`# **${title}**\n正文`, `# **${title}**\n正文`],
]) assert.equal(inboxReadingBody(input!, title), expected);

async function mockApi(page: Page): Promise<void> {
  const items: BiboInboxItem[] = [
    { id: "brief", title, body, kind: "agent", source: { kind: "bibo" }, createdAt: "2026-09-26T01:17:00.000Z", updatedAt: "2026-09-26T01:17:00.000Z", readAt: null, resolvedAt: null, version: 1 },
    { id: "other", title: "另一条很长的消息标题，用于检查两行展示、日期以及摘要在紧凑列表中是否相互挤压", body: "# 不同的正文标题\n\n完整正文需要保留。", kind: "reminder", source: { kind: "file", id: "missing" }, createdAt: "2026-09-25T01:17:00.000Z", updatedAt: "2026-09-25T01:17:00.000Z", readAt: null, resolvedAt: null, version: 1 },
    { id: "empty", title: "仅有标题的消息", body: "# 仅有标题的消息\n\n", kind: "reminder", source: { kind: "bibo" }, createdAt: "2026-09-25T01:17:00.000Z", updatedAt: "2026-09-25T01:17:00.000Z", readAt: "2026-09-25T02:00:00.000Z", resolvedAt: "2026-09-25T02:00:00.000Z", version: 1 },
  ];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const payload = request.method() === "POST" ? request.postDataJSON() as { action?: string; input?: Record<string, unknown> } : {};
    const { action, input = {} } = payload;
    if (action === "file.get") return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "来源不存在" }) });
    const item = items.find((entry) => entry.id === input.id);
    if (action === "inbox.read" && item) { item.readAt = "2026-09-27T01:00:00.000Z"; item.version += 1; }
    if (action === "inbox.resolve" && item) { item.resolvedAt = "2026-09-27T01:00:00.000Z"; item.version += 1; }
    const result = path === "/api/auth/me" ? { user: { id: "layout-smoke", email: "layout@example.com" } }
      : path === "/api/sessions" ? { sessions: [] }
        : action === "overview.get" ? { result: { inbox: items.filter((entry) => !entry.resolvedAt), events: [], tasks: [], notes: [], projects: [], counts: { unread: items.filter((entry) => !entry.readAt && !entry.resolvedAt).length, activeTasks: 0 } } }
          : action === "inbox.list" ? { result: { items: items.filter((entry) => (!input.unresolved || !entry.resolvedAt) && (!input.unread || !entry.readAt)), nextCursor: null } }
          : item ? { result: item } : { result: { items: [], nextCursor: null } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
}

async function bounds(page: Page): Promise<void> {
  const overflow = await page.locator(".inbox-layout, .inbox-detail-toolbar, .inbox-article, .inbox-item-meta, .inbox-layout .ui-list-row").evaluateAll((nodes) => nodes.flatMap((node) => {
    const box = node.getBoundingClientRect();
    return box.width && (box.left < -1 || box.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 1) ? [node.className] : [];
  }));
  assert.deepEqual(overflow, []);
}

try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(`Inbox preview exited: ${server.exitCode}`);
    try { if ((await fetch(base)).ok) break; } catch { /* Preview is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [2048, 1440, 1100, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 760 });
      await page.clock.install({ time: new Date("2026-09-26T01:20:00.000Z") });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await mockApi(page);
      await page.goto(`${base}/inbox`);
      const list = page.locator(".bibo-list-pane");
      const choose = async (name: string) => {
        if (width <= 1100 && await page.locator(".inbox-back").isVisible()) await page.locator(".inbox-back").click();
        await list.getByRole("button", { name: new RegExp(name) }).click();
      };
      await choose(title);
      assert.equal(await list.locator('[role="img"][aria-label="未读"]').count(), 2);
      assert.equal(await list.locator("time").first().textContent(), "3分钟前");
      if (width === 1440) {
        await page.clock.fastForward(60_000);
        await page.waitForFunction(() => document.querySelector(".bibo-list-pane time")?.textContent === "4分钟前");
      }
      assert.equal(await page.getByRole("heading", { name: title, exact: true }).count(), 1);
      await page.getByRole("heading", { name: "头条要闻", exact: true }).waitFor();
      await bounds(page);
      if (width > 1100) {
        const geometry = await page.evaluate(() => ({ list: document.querySelector(".bibo-list-pane")!.getBoundingClientRect().width, article: document.querySelector(".inbox-article")!.getBoundingClientRect().width }));
        assert.ok(geometry.list >= 300 && geometry.list <= 360, JSON.stringify(geometry));
        assert.ok(geometry.article <= 760);
        assert.equal(await list.locator(".ui-list-row.is-selected").getAttribute("aria-pressed"), "true");
        await list.locator(".ui-list-row").last().hover();
        await list.locator(".ui-list-row.is-selected").focus();
        await page.mouse.move(800, 30);
      }
      await page.screenshot({ path: `/tmp/bibo-inbox-layout-${width}.png`, fullPage: true });
      const reader = page.locator(".inbox-reader");
      await reader.evaluate((node) => node.scrollTo(0, node.scrollHeight));
      const read = page.getByRole("button", { name: "标记已读", exact: true });
      const rect = await read.boundingBox();
      assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 200 && rect.height >= (width < 760 ? 44 : 32), "actions retain the shared mouse/touch target size while reading");
      await read.click();
      await read.waitFor({ state: "hidden" });
      assert.equal(await list.locator('[role="img"][aria-label="未读"]').count(), 1, "reading removes the unread marker");
      await choose("另一条很长");
      assert.equal(await reader.evaluate((node) => node.scrollTop), 0, "a new message starts at its top");
      await page.getByRole("heading", { name: "不同的正文标题", exact: true }).waitFor();
      await page.getByRole("button", { name: "查看来源 ↗", exact: true }).click();
      await page.getByText("来源已删除或无法访问。", { exact: true }).waitFor();
      assert.equal(await page.locator(".inbox-article").isVisible(), true);
      await bounds(page);
      await choose(title);
      await page.getByRole("button", { name: "已处理", exact: true }).click();
      await page.getByRole("heading", { name: title, exact: true }).waitFor({ state: "hidden" });
      const scope = page.getByRole("group", { name: "收件箱范围" });
      await scope.getByRole("button", { name: "未读", exact: true }).click();
      assert.equal(await list.locator(".ui-list-row").count(), 1);
      await scope.getByRole("button", { name: "全部", exact: true }).click();
      await list.getByRole("button", { name: new RegExp(title) }).waitFor();
      assert.equal(await list.locator(".ui-list-row").count(), 3);
      assert.equal(await list.locator('[role="img"][aria-label="已处理"]').count(), 2, "resolved items show check marks");
      assert.equal(await list.locator('[role="img"][aria-label="未读"]').count(), 1);
      const empty = list.getByRole("button", { name: /仅有标题的消息/ });
      assert.equal(await empty.locator("small").count(), 0, "a title-only body has no preview placeholder");
      const insets = await list.locator(".ui-list-row").evaluateAll((rows) => rows.map((row) => {
        const copy = row.querySelector(".inbox-item-copy")!;
        const left = copy.getBoundingClientRect().left;
        const marker = row.querySelector('[role="img"]');
        const heading = row.querySelector(".inbox-item-heading")!.getBoundingClientRect();
        const meta = row.querySelector(".inbox-item-meta")!.getBoundingClientRect();
        return {
          inset: left - row.getBoundingClientRect().left,
          title: row.querySelector("strong")!.getBoundingClientRect().left - left,
          marker: marker ? marker.getBoundingClientRect().right - copy.getBoundingClientRect().right : 0,
          markerInHeading: !marker || marker.parentElement?.classList.contains("inbox-item-heading"),
          date: row.querySelector("time")!.getBoundingClientRect().right - copy.getBoundingClientRect().right,
          titleHeight: row.querySelector("strong")!.getBoundingClientRect().height,
          rowHeight: meta.bottom - heading.top,
        };
      }));
      assert.ok(insets.every(({ inset, title, marker, markerInHeading, date, titleHeight, rowHeight }) => inset === 12 && title === 0 && Math.abs(marker) < 1 && markerInHeading && Math.abs(date) < 1 && titleHeight <= 21 && rowHeight <= 42), JSON.stringify(insets));
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`Bibo inbox layout passed: ${width}px`);
    }
  } finally { await browser.close(); }
} finally {
  if (server?.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit").catch(() => undefined); }
}
