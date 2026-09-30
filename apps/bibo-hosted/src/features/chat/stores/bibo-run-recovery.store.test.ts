import assert from "node:assert/strict";
import test from "node:test";
import { BiboClient, type BiboRunSnapshot } from "@nextclaw/bibo-client";
import { BiboRunRecoveryStore } from "./bibo-run-recovery.store";

const snapshot: BiboRunSnapshot = { runId: "old", sessionId: "session", message: "old input", phase: "completed",
  startedAt: 1, updatedAt: 2, partial: "", clientRequestId: "old-request" };
const observation = () => {
  const events: string[] = [], errors: string[] = [], connections: boolean[] = [];
  let idle = 0;
  return { events, errors, connections, idle: () => idle, observer: {
    event: (event: { name: string }) => events.push(event.name), snapshot: () => {},
    idle: () => { idle++; }, connection: (value: boolean) => connections.push(value),
    failure: (error: unknown) => errors.push(error instanceof Error ? error.message : String(error)),
  } };
};

test("an unaccepted send cannot be mistaken for an older completed reply", async () => {
  const calls: string[] = [];
  const client = new BiboClient({ fetch: async (input) => {
    calls.push(String(input));
    return String(input) === "/api/chat" ? Response.json({ error: "model unavailable" }, { status: 503 })
      : Response.json({ run: snapshot, activeRuns: [] });
  } });
  const seen = observation(), recovery = new BiboRunRecoveryStore(client, seen.observer);
  await recovery.start("session", "new-request", (signal, onEvent) => client.chat("new input", onEvent, "session", undefined, "new-request", signal));
  assert.deepEqual(calls, ["/api/chat", "/api/runs?sessionId=session"]);
  assert.deepEqual(seen.errors, ["model unavailable"]);
  assert.equal(seen.events.includes("committed"), false);
  assert.equal(seen.idle(), 1);
  recovery.dispose();
});

test("lost acceptance reconnects a matching committed request without a second POST", async () => {
  let posts = 0;
  const run = { ...snapshot, runId: "new", clientRequestId: "new-request" };
  const frames = `event: snapshot\ndata: ${JSON.stringify(run)}\n\nevent: committed\ndata: ${JSON.stringify({ text: "saved", messages: [], session: null })}\n\n`;
  const client = new BiboClient({ fetch: async (input) => {
    if (String(input) === "/api/chat") { posts++; throw new TypeError("connection lost"); }
    return String(input).endsWith("/events") ? new Response(frames, { headers: { "content-type": "text/event-stream" } })
      : Response.json({ run, activeRuns: [] });
  } });
  const seen = observation(), recovery = new BiboRunRecoveryStore(client, seen.observer);
  await recovery.start("session", "new-request", (signal, onEvent) => client.chat("new input", onEvent, "session", undefined, "new-request", signal));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(posts, 1);
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(seen.events, ["snapshot", "committed"]);
  assert.equal(seen.idle(), 1);
  recovery.dispose();
});

test("an unreachable authority remains unknown/busy rather than becoming idle", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value: { visibilityState: "hidden" }, configurable: true });
  const client = new BiboClient({ fetch: async () => { throw new TypeError("offline"); } });
  const seen = observation(), recovery = new BiboRunRecoveryStore(client, seen.observer);
  try {
    await recovery.sync("session");
    assert.equal(seen.idle(), 0);
    assert.equal(seen.connections.at(-1), true);
    assert.deepEqual(seen.errors, []);
  } finally { recovery.dispose(); if (previous) Object.defineProperty(globalThis, "document", previous); else Reflect.deleteProperty(globalThis, "document"); }
});
