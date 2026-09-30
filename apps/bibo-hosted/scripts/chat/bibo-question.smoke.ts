import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page } from "playwright";
import { mockApi } from "../personal-workspace.fixture";

const port = process.env.BIBO_SMOKE_PORT ?? String(30000 + process.pid % 20000);
const base = process.env.BIBO_SMOKE_BASE ?? `http://127.0.0.1:${port}`;
const server = process.env.BIBO_SMOKE_BASE ? null : spawn(process.execPath, [new URL("../../node_modules/vite/bin/vite.js", import.meta.url).pathname,
  "preview", "--host", "127.0.0.1", "--port", port, "--strictPort"],
{ cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });

async function ready(): Promise<void> {
  if (!server) return;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Question preview exited before readiness");
    try { if ((await fetch(base)).ok) return; } catch { /* Preview is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Question preview did not start");
}

async function checkSilentSkip(page: Page, title: string, requestCount: () => number): Promise<void> {
  const panel = page.getByRole("region", { name: "问题" });
  const reminder = page.locator(".bibo-question-reopen");
  const entry = page.locator(".ui-message--assistant .ui-message__body").first().getByRole("button", { name: `回答问题：${title}` });
  await panel.getByRole("button", { name: "关闭问题", exact: true }).click();
  await reminder.waitFor();
  await reminder.click();
  await panel.getByRole("button", { name: "跳过", exact: true }).click();
  await panel.waitFor({ state: "hidden" });
  assert.equal(await reminder.count(), 0, "skip hides the reminder while ordinary close retains it");
  assert.equal(requestCount(), 0, "skip sends no chat request");
  assert.equal(await page.locator(".ui-message--user").count(), 1, "skip adds no user reply");
  await entry.waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await entry.waitFor();
  assert.equal(await panel.count(), 0, "skipped questions do not reopen after reload");
  assert.equal(await reminder.count(), 0, "reload keeps skipped questions quiet");
  assert.equal(requestCount(), 0);
  await entry.click();
  await panel.waitFor();
}

async function checkSavedAnswer(page: Page): Promise<void> {
  const body = page.locator(".ui-message--assistant .ui-message__body").first();
  await body.getByText("已回答", { exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await body.getByText("已回答", { exact: true }).waitFor();
  assert.equal(await body.getByText("随后继续。", { exact: true }).count(), 1);
}

async function checkQuestionSequenceAndRecovery(page: Page): Promise<void> {
  await mockApi(page);
  const question = { id: "question-visual-smoke", title: "查询哪个城市？", messageId: "assistant-question-smoke",
    askedAt: "2026-09-29T00:00:00.000Z", status: "pending", options: ["北京", "上海"] };
  const assistant = { role: "assistant", text: "先说明。\n\n随后继续。", at: "2026-09-29T00:00:00.000Z",
    content: [{ type: "text", text: "先说明。" }, { type: "questions", ids: [question.id] }, { type: "text", text: "随后继续。" }], questions: [question] };
  const initial = [{ role: "user", text: "帮我查天气", at: "2026-09-29T00:00:00.000Z" }, assistant];
  let history: unknown[] = initial;
  await page.route("**/api/history?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ messages: history }) }));
  let failFirst = true;
  let chatRequests = 0;
  let releaseFailure: (() => void) | undefined;
  const failureGate = new Promise<void>((resolve) => { releaseFailure = resolve; });
  await page.route("**/api/chat", async (route) => {
    chatRequests += 1;
    if (failFirst) {
      failFirst = false;
      await failureGate;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "暂时无法保存" }) });
      return;
    }
    const user = { role: "user", text: "杭州", at: "2026-09-29T00:01:00.000Z",
      replyToQuestion: { id: question.id, title: question.title, action: "answered" } };
    history = [initial[0], { ...assistant, questions: [{ ...question, status: "answered", answer: "杭州" }] }, user,
      { role: "assistant", text: "我会查询杭州。", at: "2026-09-29T00:01:01.000Z" }];
    const frames = [["accepted", { runId: "answer-run" }], ["delta", { text: "我会查询杭州。" }], ["saving", {}],
      ["committed", { text: "我会查询杭州。", messages: history, session: { id: "session-a", title: "产品想法", updatedAt: "2026-09-29T00:01:01.000Z" } }]]
      .map(([name, value]) => `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`).join("");
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: frames });
  });
  await page.goto(`${base}/chat/session-a`, { waitUntil: "domcontentloaded" });
  const panel = page.getByRole("region", { name: "问题" });
  await panel.getByRole("heading", { name: question.title }).waitFor();
  const body = page.locator(".ui-message--assistant .ui-message__body").first();
  const sequence = await body.locator(":scope > .bibo-ordered-content > *").allTextContents();
  assert.deepEqual(sequence.map((text) => text.trim()), ["先说明。", question.title, "随后继续。"], "question stays inside the assistant body in generation order");
  await checkSilentSkip(page, question.title, () => chatRequests);
  await panel.getByRole("textbox", { name: "或自行填写回复" }).fill("杭州");
  await panel.getByRole("button", { name: "发送", exact: true }).click();
  await panel.waitFor({ state: "hidden" });
  assert.equal(failFirst, false, "the reply request started while the panel was closed");
  releaseFailure?.();
  await panel.waitFor({ state: "visible" });
  assert.equal(await panel.getByRole("textbox", { name: "或自行填写回复" }).inputValue(), "杭州", "failed custom answers return to the question input");
  await panel.getByRole("button", { name: "发送", exact: true }).click();
  await panel.waitFor({ state: "hidden" });
  await checkSavedAnswer(page);
  assert.equal(chatRequests, 2, "only the failed answer and its successful retry send requests");
  console.log("question skip, reopen, failed answer and reload verified", page.viewportSize()?.width);
}

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 760 });
      await checkQuestionSequenceAndRecovery(page);
      await page.close();
    }
  } finally { await browser.close(); }
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
}
