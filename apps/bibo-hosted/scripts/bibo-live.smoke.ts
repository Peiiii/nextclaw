import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const origin = "https://app.bibo.bot";
const tokenFile = process.env.BIBO_SMOKE_TOKEN_FILE;
if (!tokenFile) throw new Error("Set BIBO_SMOKE_TOKEN_FILE to a local file containing a platformToken.");

const credential = readFileSync(tokenFile, "utf8").trim();
const token = credential.startsWith("{")
  ? (JSON.parse(credential) as { platformToken?: string }).platformToken
  : credential;
if (!token) throw new Error("The smoke token file does not contain a platformToken.");

const cookie = `bibo_session=${encodeURIComponent(token)}`;
const headers = { cookie };
const requestId = `bibo-live-${crypto.randomUUID().slice(0, 8)}`;
const prompt = `请只用一句简短中文回复“${requestId} 已收到”，不要执行工具。`;
const abort = new AbortController();
const timeout = setTimeout(() => abort.abort(), 90_000);

type StreamState = { accepted: boolean; saving: boolean; committed: boolean; deltaCount: number; firstDeltaMs: number };

function recordFrame(frame: string, state: StreamState, started: number): void {
  const name = frame.match(/^event: (.+)$/m)?.[1];
  const data = frame.match(/^data: (.+)$/m)?.[1];
  if (!name || !data) return;
  const payload = JSON.parse(data) as { error?: string };
  if (name === "error") throw new Error(payload.error ?? "Chat stream failed");
  if (name === "accepted") state.accepted = true;
  if (name === "delta") {
    state.deltaCount += 1;
    state.firstDeltaMs ||= Math.round(performance.now() - started);
  }
  if (name === "saving") state.saving = true;
  if (name === "committed") state.committed = true;
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(`${origin}${path}`, { headers, signal: abort.signal });
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return await response.json() as T;
}

async function streamedRun(): Promise<{ deltaCount: number; firstDeltaMs: number; totalMs: number }> {
  const started = performance.now();
  const response = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { ...headers, origin, accept: "text/event-stream", "content-type": "application/json" },
    body: JSON.stringify({ message: prompt }),
    signal: abort.signal,
  });
  assert.equal(response.status, 200, `Chat returned ${response.status}`);
  assert.ok(response.headers.get("content-type")?.includes("text/event-stream"), "Chat must stream SSE");
  assert.ok(response.body, "Chat stream is empty");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const state: StreamState = { accepted: false, saving: false, committed: false, deltaCount: 0, firstDeltaMs: 0 };
  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    let boundary: number;
    while ((boundary = pending.indexOf("\n\n")) >= 0) {
      const frame = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      recordFrame(frame, state, started);
    }
    if (done) break;
  }
  assert.ok(state.accepted, "Run was not accepted");
  assert.ok(state.deltaCount > 0, "No live output was streamed");
  assert.ok(state.saving, "Snapshot save was not announced");
  assert.ok(state.committed, "Run did not commit to storage");
  return { deltaCount: state.deltaCount, firstDeltaMs: state.firstDeltaMs, totalMs: Math.round(performance.now() - started) };
}

try {
  const account = await json<{ user?: { id: string } }>("/api/auth/me");
  assert.ok(account.user?.id, "Smoke account is not authenticated");
  const before = await json<{ messages: Array<{ role: string; text: string }> }>("/api/history");
  const stream = await streamedRun();
  const after = await json<{ messages: Array<{ role: string; text: string }> }>("/api/history");
  assert.equal(after.messages.length, before.messages.length + 2, "Saved history must contain one new exchange");
  assert.equal(after.messages.at(-2)?.text, prompt, "Saved user message differs");
  assert.ok(after.messages.at(-1)?.text.includes(requestId), "Saved answer is missing the request marker");

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      await context.addCookies([{ name: "bibo_session", value: token, domain: "app.bibo.bot", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin, { waitUntil: "networkidle" });
      await page.locator(".bibo-message").first().waitFor();
      const layout = await page.evaluate(() => ({
        body: document.body.scrollHeight,
        viewport: innerHeight,
        composerBottom: document.querySelector(".bibo-composer")!.getBoundingClientRect().bottom,
        listHeight: document.querySelector(".bibo-messages")!.clientHeight,
        contentHeight: document.querySelector(".bibo-messages")!.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(layout.body, layout.viewport, "The page must not scroll behind the chat");
      assert.ok(layout.composerBottom <= layout.viewport, "Composer must remain visible");
      if (after.messages.length >= 8) assert.ok(layout.contentHeight > layout.listHeight, "Long history must scroll inside the message list");
      assert.equal(layout.horizontalOverflow, false, "Page has horizontal overflow");
      assert.deepEqual(errors, [], "Browser raised a runtime error");
      assert.ok(await page.locator(".bibo-message--assistant").filter({ hasText: requestId }).count(), "Saved answer did not load after refresh");
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ ok: true, requestId, ...stream, saved: true, desktop: true, mobile: true }));
} finally { clearTimeout(timeout); }
