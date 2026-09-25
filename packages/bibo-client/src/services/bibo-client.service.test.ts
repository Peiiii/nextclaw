import assert from "node:assert/strict";
import test from "node:test";
import { BiboClient } from "./bibo-client.service";
import { BiboClientError } from "../utils/bibo-protocol.utils";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json" },
});

test("uses same-origin credentials and typed account/history responses", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = new BiboClient({ fetch: (async (path: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(path), init });
    return String(path).endsWith("/auth/me")
      ? json({ user: { id: "u1", email: "one@example.com", internal: true } })
      : json({ messages: [{ role: "assistant", text: "你好", at: "now" }] });
  }) as typeof fetch });

  assert.deepEqual(await client.account(), { id: "u1", email: "one@example.com" });
  assert.deepEqual(await client.history(), [{ role: "assistant", text: "你好", at: "now" }]);
  assert.deepEqual(calls.map((call) => call.path), ["/api/auth/me", "/api/history"]);
  assert.ok(calls.every((call) => call.init?.credentials === "same-origin"));
});

test("exposes HTTP status and server error without accepting an error response", async () => {
  const client = new BiboClient({ fetch: (async () => json({ error: "请先登录。" }, 401)) as typeof fetch });
  await assert.rejects(client.account(), (error: unknown) => error instanceof BiboClientError
    && error.status === 401 && error.message === "请先登录。");
});

test("keeps auth and control requests on the same-origin API", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = new BiboClient({ fetch: (async (path: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(path), init });
    if (String(path).endsWith("/send-code")) return json({ maskedEmail: "o***@example.com" });
    if (String(path).endsWith("/login") || String(path).endsWith("/register")) {
      return json({ user: { id: "u1", email: "one@example.com" } });
    }
    return json({ ok: true });
  }) as typeof fetch });

  assert.deepEqual(await client.sendCode("one@example.com"), { maskedEmail: "o***@example.com" });
  await client.login("one@example.com", "password");
  await client.register("one@example.com", "password", "123456");
  await client.cancel("run-1");
  await client.reset();
  await client.logout();
  assert.deepEqual(calls.map(({ path }) => path), [
    "/api/auth/send-code", "/api/auth/login", "/api/auth/register", "/api/cancel", "/api/reset", "/api/auth/logout",
  ]);
  assert.ok(calls.every(({ init }) => init?.method === "POST" && init.credentials === "same-origin"));
  assert.deepEqual(JSON.parse(String(calls[3]?.init?.body)), { runId: "run-1" });
});

test("normalizes network failures", async () => {
  const client = new BiboClient({ fetch: (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch });
  await assert.rejects(client.history(), (error: unknown) => error instanceof BiboClientError
    && error.message === "网络连接失败，请稍后重试。");
});

test("accepts a committed JSON reply from an older container", async () => {
  const client = new BiboClient({ fetch: (async () => json({
    text: "旧容器回答", messages: [{ role: "assistant", text: "旧容器回答", at: "now" }],
  })) as typeof fetch });
  const events: string[] = [];
  await client.chat("你好", (event) => events.push(event.name));
  assert.deepEqual(events, ["committed"]);
});

test("delivers a delta before committed data exists", async () => {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({
    start: (streamController) => { controller = streamController; },
  }), { headers: { "content-type": "text/event-stream" } });
  const client = new BiboClient({ fetch: (async () => response) as typeof fetch });
  const events: string[] = [];
  const completion = client.chat("你好", (event) => events.push(event.name));

  controller.enqueue(encoder.encode('event: accepted\ndata: {"runId":"r1"}\n\nevent: delta\ndata: {"text":"第一段"}\n\n'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ["accepted", "delta"]);

  controller.enqueue(encoder.encode('event: saving\ndata: {}\n\nevent: committed\ndata: {"text":"第一段","messages":[{"role":"assistant","text":"第一段","at":"now"}]}\n\n'));
  controller.close();
  await completion;
  assert.deepEqual(events, ["accepted", "delta", "saving", "committed"]);
});
