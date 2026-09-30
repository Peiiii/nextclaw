import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chromium, type Locator, type Page } from "playwright";
import type { BiboMessage } from "@nextclaw/bibo-client";
import { mockApi, openMarkdownSource } from "../personal-workspace.fixture";

const port = String(30000 + process.pid % 20000);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [new URL("../../node_modules/vite/bin/vite.js", import.meta.url).pathname, "--host", "127.0.0.1", "--port", port, "--strictPort"], { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
const browser = await chromium.launch();
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base)).ok) break; } catch { /* Vite is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
    page.setDefaultTimeout(12000);
    const errors: string[] = [], dialogs: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", dialog => { dialogs.push(dialog.type()); void dialog.accept(); });
    await mockApi(page);
    await page.goto(`${base}/notes`, { waitUntil: "networkidle" });
    const collection = page.getByRole("complementary", { name: "全部笔记", exact: true });
    await collection.getByRole("button", { name: "新笔记", exact: true }).click();
    await page.locator(".tiptap:visible h1").getByText("无标题笔记", { exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog", { name: "新笔记", exact: true }).count(), 0);
    await page.getByRole("button", { name: /^文档 / }).click();
    const menu = page.getByRole("menu");
    const items = await menu.getByRole("menuitem").evaluateAll(nodes => nodes.map(node => ({ title: node.textContent, icon: Boolean(node.querySelector("svg")) })));
    assert.ok(items.every(item => item.icon));
    assert.ok(items.every(item => !item.title?.endsWith(".md")), "title menu contains actions rather than document rows");
    assert.equal(await menu.getByRole("separator").count(), 3);
    await page.getByRole("menuitem", { name: "返回全部笔记" }).click();
    await collection.getByRole("button", { name: "新笔记", exact: true }).click();
    await page.locator(".tiptap:visible h1").getByText("无标题笔记 2", { exact: true }).waitFor();
    const currentPath = page.locator('.file-breadcrumb [aria-current="page"]');
    assert.equal(await currentPath.locator("svg").count(), 1, "current breadcrumb exposes its document switcher");
    await currentPath.click();
    await page.getByRole("dialog", { name: "浏览目录" }).getByRole("button", { name: "无标题笔记.md", exact: true }).click();
    await page.locator(".tiptap:visible h1").getByText("无标题笔记", { exact: true }).waitFor();
    await currentPath.click();
    await page.getByRole("dialog", { name: "浏览目录" }).getByRole("button", { name: "无标题笔记 2.md", exact: true }).click();
    await page.locator(".tiptap:visible h1").getByText("无标题笔记 2", { exact: true }).waitFor();
    await openMarkdownSource(page);
    await page.locator(".cm-content:visible").fill("# 测试笔记\n\n第一段\n\n第二段\n\n- 第一项\n- 第二项\n  - 嵌套项\n\n- [ ] 待办事项");
    await body(page);
    await page.locator(".tiptap:visible").getByText("第二段", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
    }), false, "dirty documents flush their draft without blocking reload");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".tiptap:visible").getByText("第二段", { exact: true }).waitFor();
    assert.deepEqual(dialogs, [], "refreshing a dirty note never opens a browser confirmation");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByText("已保存", { exact: true }).waitFor();
    if (width > 600) await handles(page);
    await page.screenshot({ path: `/tmp/bibo-document-chat-${width}.png`, animations: "disabled" });
    await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "打开右侧工作区" }).click();
    if (width > 600) await split(page);
    else assert.equal(await page.getByRole("separator").count(), 0, "mobile workspace is a single surface");
    await page.getByRole("button", { name: "关闭工作区" }).click();
    await streamingCards(page);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${width}px: direct note creation, unique names, action menu, dirty reload recovery, save, workspace and chat passed`);
  }
} finally { await browser.close(); server.kill(); }

async function streamingCards(page: Page) {
  const first = pause(), second = pause();
  const at = new Date().toISOString();
  const messages: BiboMessage[] = [{ role: "user", text: "分段回复", at }, { role: "assistant", text: "第一张卡片\n\n第二张卡片", at,
    content: [{ type: "text", text: "第一张卡片" }, { type: "text", text: "第二张卡片" }] }];
  const stream = await openCardStream(new URL(page.url()).origin, messages, [first.wait, second.wait]);
  const address = stream.address() as { port: number };
  await page.route("**/api/chat", route => route.continue({ url: `http://127.0.0.1:${address.port}/api/chat` }));
  await page.route("**/api/history*", route => route.fulfill({ json: { messages } }));
  try {
    await page.getByRole("textbox", { name: /告诉 Bibo/ }).fill("分段回复");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    const firstCard = page.locator(".ui-message--assistant").filter({ hasText: "第一张卡片" });
    await firstCard.waitFor();
    const node = (await firstCard.elementHandle())!;
    first.release();
    await page.locator(".ui-message--assistant").filter({ hasText: "第二张卡片" }).waitFor();
    assert.equal(await node.evaluate(element => element.isConnected), true, "later chunks preserve the earlier card node");
    second.release();
    await page.waitForFunction(() => !document.querySelector(".ui-message--assistant.ui-message--pending"));
    assert.equal(await node.evaluate(element => element.isConnected), true, "commit preserves the streamed card node");
    const cards = page.locator(".ui-message--assistant");
    assert.equal(await cards.count(), 2, JSON.stringify(await cards.allTextContents()));
    await copyResponse(page, cards);
    assert.equal(await page.locator(".bibo-message-time").count(), 1, "same-time user/assistant and separate cards share one timestamp");
    await page.reload({ waitUntil: "networkidle" });
    await firstCard.waitFor();
    assert.deepEqual(await cards.locator(".ui-message__body").allTextContents(), ["第一张卡片", "第二张卡片"]);
  } finally {
    first.release(); second.release();
    stream.closeAllConnections();
    await new Promise<void>(resolve => stream.close(() => resolve()));
  }
}

async function copyResponse(page: Page, cards: Locator) {
  assert.equal(await cards.getByRole("button", { name: "复制回答", exact: true }).count(), 1, "one copy action preserves the complete response without gaps between its cards");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await cards.getByRole("button", { name: "复制回答", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "第一张卡片\n\n第二张卡片");
}

function pause() {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  return { wait, release };
}

async function openCardStream(origin: string, messages: BiboMessage[], pauses: [Promise<void>, Promise<void>]) {
  const stream = createServer(async (request, response) => {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("access-control-allow-headers", "content-type");
    if (request.method === "OPTIONS") { response.end(); return; }
    response.writeHead(200, { "content-type": "text/event-stream" });
    const send = (name: string, data: unknown) => response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    send("accepted", { runId: "stream-cards" });
    send("delta", { text: "第一张卡片", blockId: "first" });
    await pauses[0];
    send("delta", { text: "第二张卡片", blockId: "second" });
    await pauses[1];
    send("saving", {});
    const at = messages[0].at;
    send("committed", { text: messages[1].text, messages, session: { id: "session-a", title: "分段回复", createdAt: at, updatedAt: at, messageCount: 2 } });
    response.end();
  });
  await new Promise<void>(resolve => stream.listen(0, "127.0.0.1", resolve));
  return stream;
}

async function body(page: Page) {
  await page.getByRole("button", { name: "文件操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "正文", exact: true }).click();
}
async function handles(page: Page) {
  for (const selector of ["h1", "p", "li > p", "li li > p", "li[data-type=taskItem] p"]) {
    const target = page.locator(`.tiptap:visible ${selector}`).last();
    await target.hover({ position: { x: 50, y: 10 } });
    await page.locator(".ui-markdown-block-handle:visible").waitFor();
    await page.waitForTimeout(100);
    const geometry = await target.evaluate(element => {
      const text = element.getBoundingClientRect(), line = parseFloat(getComputedStyle(element).lineHeight);
      const handle = document.querySelector('.ui-markdown-block-handle button[aria-label="块操作"]')!.getBoundingClientRect();
      const list = element.closest("li")?.parentElement?.getBoundingClientRect();
      return { gap: Math.abs(handle.y + handle.height / 2 - (text.y + line / 2)), handleRight: handle.right, markerEdge: list?.left };
    });
    assert.ok(geometry.gap < 2, `${selector}: handle is centered on the first line (${geometry.gap}px)`);
    if (geometry.markerEdge !== undefined) assert.ok(geometry.handleRight <= geometry.markerEdge, `${selector}: handle stays outside list markers`);
  }
}
async function split(page: Page) {
  const divider = page.getByRole("separator", { name: /调整分栏宽度/ });
  const box = (await divider.boundingBox())!;
  const before = Number(await divider.getAttribute("aria-valuenow"));
  await page.mouse.move(box.x + box.width / 2, box.y + 100); await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + 100, { steps: 8 }); await page.mouse.up();
  const changed = Number(await divider.getAttribute("aria-valuenow"));
  assert.ok(changed > before);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(Number(await divider.getAttribute("aria-valuenow")), changed);
  await divider.focus(); await page.keyboard.press("ArrowLeft");
  assert.equal(Number(await divider.getAttribute("aria-valuenow")), changed + 2);
  await page.keyboard.press("Home"); assert.equal(await divider.getAttribute("aria-valuenow"), "55");
  await divider.dblclick(); assert.equal(await divider.getAttribute("aria-valuenow"), "55");
}
