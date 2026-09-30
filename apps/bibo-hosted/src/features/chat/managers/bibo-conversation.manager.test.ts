import assert from "node:assert/strict";
import test from "node:test";
import { BiboClient, type BiboRunSnapshot } from "@nextclaw/bibo-client";
import { BiboConversationManager, type BiboSubmission } from "./bibo-conversation.manager";

const run: BiboRunSnapshot = { runId: "task", sessionId: "session", message: "input", phase: "generating",
  startedAt: 1, updatedAt: 2, partial: "first step", clientRequestId: "request" };
const receipt: BiboSubmission = { sessionId: "session", message: "input", clientRequestId: "request" };
const frame = (name: string, value: unknown) => `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`;
const result = { text: "saved", messages: [{ role: "user", text: "input", at: new Date(1).toISOString() },
  { role: "assistant", text: "saved", at: new Date(3).toISOString() }], session: null };
const completed = (snapshot: BiboRunSnapshot) => new Response(frame("snapshot", snapshot) + frame("committed", result),
  { headers: { "content-type": "text/event-stream" } });
const live = (snapshot: BiboRunSnapshot, signal?: AbortSignal | null) => new Response(new ReadableStream({
  start: (controller) => {
    controller.enqueue(new TextEncoder().encode(frame("snapshot", snapshot)));
    signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")), { once: true });
  },
}), { headers: { "content-type": "text/event-stream" } });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const until = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(predicate(), true, "expected asynchronous business result");
};
function setup(fetch: typeof globalThis.fetch, pending?: BiboSubmission | string) {
  const values = new Map<string, string>();
  if (pending) values.set("bibo-pending-user", typeof pending === "string" ? pending : JSON.stringify(pending));
  const errors: { input: BiboSubmission; text: string }[] = [], commits: string[] = [], created: string[] = [], contents: string[] = [], confirmations: BiboSubmission[] = [];
  const manager = new BiboConversationManager(new BiboClient({ fetch }), {
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); },
  }, {
    failed: (input, error) => errors.push({ input, text: error instanceof Error ? error.message : String(error) }),
    confirmed: (input) => confirmations.push(input),
    committed: (_, sessionId) => commits.push(sessionId), created: (session) => created.push(session.id), content: (shown) => contents.push(shown.id),
  });
  manager.bindAccount("user");
  return { manager, values, errors, commits, created, contents, confirmations };
}

test("pending receipt plus delayed authority stays checking, then attaches without resending", async (t) => {
  const authority = deferred<Response>();
  const calls: string[] = [];
  const seen = setup(async (input, init) => {
    calls.push(String(input));
    return String(input).endsWith("/events") ? live(run, init?.signal) : authority.promise;
  }, receipt);
  t.after(() => seen.manager.dispose());
  const opening = seen.manager.connect("session");
  assert.equal(seen.manager.view.connection, "checking");
  assert.equal(seen.manager.view.busy, true);
  assert.equal(seen.manager.view.pendingMessage, null);
  assert.deepEqual(seen.errors, []);
  authority.resolve(Response.json({ run, activeRuns: [run] }));
  await opening;
  await until(() => seen.manager.view.partial === "first step");
  assert.equal(seen.manager.view.phase, "generating");
  assert.equal(seen.manager.view.runId, "task");
  assert.deepEqual(calls, ["/api/runs?sessionId=session", "/api/runs/task/events"]);
  assert.deepEqual(seen.errors, []);
});

test("completed authoritative task replays commit once and removes receipt", async (t) => {
  const saved = { ...run, phase: "completed" as const };
  const seen = setup(async (input) => String(input).endsWith("/events") ? completed(saved) : Response.json({ run: saved, activeRuns: [] }), receipt);
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  await until(() => seen.commits.length === 1);
  assert.equal(seen.values.has("bibo-pending-user"), false);
  assert.equal(seen.manager.view.busy, false);
  await seen.manager.reconnect();
  assert.deepEqual(seen.commits, ["session"]);
  assert.deepEqual(seen.errors, []);
});

test("unreachable authority keeps known progress busy without returning input", async (t) => {
  let offline = false;
  const seen = setup(async (input, init) => {
    if (offline) throw new TypeError("offline");
    return String(input).endsWith("/events") ? live(run, init?.signal) : Response.json({ run, activeRuns: [run] });
  }, receipt);
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  offline = true;
  await seen.manager.reconnect();
  assert.equal(seen.manager.view.connection, "reconnecting");
  assert.equal(seen.manager.view.partial, "first step");
  assert.equal(seen.manager.view.busy, true);
  assert.deepEqual(seen.errors, []);
  offline = false;
  await seen.manager.reconnect();
  assert.equal(seen.manager.view.connection, "ready");
});

test("unaccepted send cannot be mistaken for an older completed task", async (t) => {
  const calls: string[] = [];
  const seen = setup(async (input) => {
    calls.push(String(input));
    return String(input) === "/api/chat" ? Response.json({ error: "model unavailable" }, { status: 503 })
      : Response.json({ run: calls.includes("/api/chat") ? { ...run, phase: "completed" } : null, activeRuns: [] });
  });
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  await until(() => !seen.manager.view.busy);
  calls.length = 0;
  await seen.manager.send({ sessionId: "session", message: "new input" });
  await until(() => seen.errors.length === 1);
  assert.deepEqual(calls, ["/api/chat", "/api/runs?sessionId=session"]);
  assert.equal(seen.errors[0]?.text, "model unavailable");
  assert.equal(seen.errors[0]?.input.message, "new input");
  assert.equal(seen.manager.view.busy, false);
});

test("lost accepted response finds request ID and commits without a second POST", async (t) => {
  let requestId = "", posts = 0;
  const seen = setup(async (input, init) => {
    if (String(input) === "/api/chat") {
      posts++;
      requestId = JSON.parse(String(init?.body)).clientRequestId;
      throw new TypeError("connection lost");
    }
    const snapshot = { ...run, clientRequestId: requestId, phase: "completed" as const };
    return String(input).endsWith("/events") ? completed(snapshot) : Response.json({ run: requestId ? snapshot : null, activeRuns: [] });
  });
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  await seen.manager.send({ sessionId: "session", message: "input" });
  await until(() => seen.commits.length === 1);
  assert.equal(posts, 1);
  assert.deepEqual(seen.errors, []);
  assert.equal(seen.manager.view.busy, false);
});

test("server failure returns question context and a deliberate retry has a new request ID", async (t) => {
  const requests: string[] = [];
  let failed: BiboRunSnapshot | null = null;
  const seen = setup(async (input, init) => {
    if (String(input) !== "/api/chat") return Response.json({ run: failed, activeRuns: [] });
    const body = JSON.parse(String(init?.body));
    assert.equal(body.questionId, "question");
    requests.push(body.clientRequestId);
    failed = { ...run, runId: body.clientRequestId, clientRequestId: body.clientRequestId, phase: "failed", error: { code: "SAVE_FAILED", message: "save failed" } };
    return new Response(frame("accepted", { runId: failed.runId }) + frame("error", { error: "save failed", code: "SAVE_FAILED" }),
      { headers: { "content-type": "text/event-stream" } });
  });
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  const input = { sessionId: "session", message: "answer", question: { id: "question", title: "Question", action: "answer" as const } };
  await seen.manager.send(input);
  await until(() => seen.errors.length === 1);
  assert.deepEqual(seen.errors[0]?.input.question, input.question);
  assert.equal(seen.errors[0]?.text, "save failed");
  await seen.manager.send(input);
  await until(() => seen.errors.length === 2);
  assert.notEqual(requests[0], requests[1]);
});

test("blank conversation locks before create, double send and reconnect cannot create twice", async (t) => {
  const creation = deferred<Response>();
  const calls: string[] = [];
  const seen = setup(async (input) => {
    calls.push(String(input));
    if (String(input) === "/api/sessions") return creation.promise;
    if (String(input) === "/api/chat") return Response.json(result);
    return Response.json({ run: null, activeRuns: [] });
  });
  t.after(() => seen.manager.dispose());
  await seen.manager.connect();
  const first = seen.manager.send({ sessionId: null, message: "input" });
  await seen.manager.send({ sessionId: null, message: "input" });
  await seen.manager.reconnect();
  assert.equal(seen.manager.view.busy, true);
  creation.resolve(Response.json({ session: { id: "created", title: "New", createdAt: "now", updatedAt: "now" } }));
  await first;
  assert.deepEqual(seen.created, ["created"]);
  assert.equal(calls.filter((call) => call === "/api/sessions").length, 1);
  assert.equal(calls.filter((call) => call === "/api/chat").length, 1);
});

test("late authority and late cancellation cannot write into another account", async (t) => {
  const authority = deferred<Response>(), cancellation = deferred<Response>();
  let delayed = false;
  const seen = setup(async (input, init) => {
    if (String(input) === "/api/cancel") return cancellation.promise;
    return String(input).endsWith("/events") ? live(run, init?.signal) : delayed ? authority.promise : Response.json({ run, activeRuns: [run] });
  });
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  const stopping = seen.manager.stop();
  delayed = true;
  const opening = seen.manager.reconnect();
  seen.manager.bindAccount("other");
  authority.resolve(Response.json({ run, activeRuns: [run] }));
  cancellation.resolve(Response.json({ error: "cancel failed" }, { status: 503 }));
  await Promise.all([opening, stopping]);
  assert.equal(seen.manager.view.runId, null);
  assert.equal(seen.manager.view.connection, "checking");
  assert.deepEqual(seen.errors, []);
});

test("fresh tab without receipt attaches active background session; repeated snapshot replaces partial", async (t) => {
  const seen = setup(async (input, init) => String(input).endsWith("/events") ? live(run, init?.signal) : Response.json({ run: null, activeRuns: [run] }));
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("another-session");
  await seen.manager.reconnect();
  assert.equal(seen.manager.view.runSessionId, "session");
  assert.equal(seen.manager.view.partial, "first step");
  assert.deepEqual(seen.errors, []);
});

test("malformed local record is not a task failure", async (t) => {
  const seen = setup(async () => Response.json({ run: null, activeRuns: [] }), "{malformed");
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  assert.equal(seen.manager.view.busy, false);
  assert.deepEqual(seen.errors, []);
});

test("unconfirmed input keeps its request ID for deliberate retry and a late accepted task clears the warning", async (t) => {
  let accepted = false;
  let posts = 0;
  const seen = setup(async (input, init) => {
    if (String(input) === "/api/chat") {
      posts++;
      assert.equal(JSON.parse(String(init?.body)).clientRequestId, receipt.clientRequestId);
      throw new TypeError("no response");
    }
    return String(input).endsWith("/events") ? live(run, init?.signal) : Response.json({ run: accepted ? run : null, activeRuns: accepted ? [run] : [] });
  }, receipt);
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  assert.equal(seen.errors.length, 1);
  assert.equal(seen.values.has("bibo-pending-user"), true);
  await seen.manager.reconnect();
  assert.equal(seen.errors.length, 1, "repeated query does not repeatedly return the same input");
  await seen.manager.send({ sessionId: "session", message: "input" });
  await until(() => !seen.manager.view.busy);
  assert.equal(posts, 1, "only the deliberate send posts");
  accepted = true;
  await seen.manager.reconnect();
  assert.deepEqual(seen.confirmations, [receipt]);
  assert.equal(seen.manager.view.phase, "generating");
});

test("late idle-session authority cannot override a newer selected session", async (t) => {
  const old = deferred<Response>();
  const seen = setup(async (input) => String(input).includes("old-session") ? old.promise : Response.json({ run: null, activeRuns: [] }));
  t.after(() => seen.manager.dispose());
  const opening = seen.manager.connect("old-session");
  await seen.manager.connect("new-session");
  old.resolve(Response.json({ run, activeRuns: [run] }));
  await opening;
  assert.equal(seen.manager.view.runId, null);
  assert.equal(seen.manager.view.busy, false);
});

test("content belongs to committed results, duplicates open once and failed streams open nothing", async (t) => {
  let shouldFail = false;
  let terminal: BiboRunSnapshot | null = null;
  let sequence = 0;
  const shown = { id: "show", sessionId: "session", target: { type: "file", payload: { path: "result.md" } } };
  const seen = setup(async (input, init) => {
    if (String(input) !== "/api/chat") return Response.json({ run: terminal, activeRuns: [] });
    const request = JSON.parse(String(init?.body));
    terminal = { ...run, runId: `task-${++sequence}`, clientRequestId: request.clientRequestId,
      phase: shouldFail ? "failed" : "completed", ...(shouldFail ? { error: { code: "SAVE_FAILED", message: "not saved" } } : {}) };
    return new Response(frame("accepted", { runId: terminal.runId }) + frame("show-content", shown) + frame("show-content", shown) +
      (shouldFail ? frame("error", { error: "not saved" }) : frame("committed", result)), { headers: { "content-type": "text/event-stream" } });
  });
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  await seen.manager.send({ sessionId: "session", message: "input" });
  assert.deepEqual(seen.contents, ["show"]);
  shouldFail = true;
  await seen.manager.send({ sessionId: "session", message: "input" });
  await until(() => seen.errors.length === 1);
  assert.deepEqual(seen.contents, ["show"]);
});

test("explicit account reset discards retained unconfirmed input", async (t) => {
  const seen = setup(async () => Response.json({ run: null, activeRuns: [] }), receipt);
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  seen.manager.dispose({ discardInput: true });
  seen.manager.bindAccount("user");
  await seen.manager.connect();
  assert.equal(seen.values.has("bibo-pending-user"), false);
  assert.equal(seen.errors.length, 1, "reset does not restore the discarded input again");
});

test("an unfinished POST response can be reconciled before accepted arrives", async (t) => {
  let clientRequestId = "";
  let posts = 0;
  const seen = setup(async (input, init) => {
    if (String(input) === "/api/chat") {
      posts++;
      clientRequestId = JSON.parse(String(init?.body)).clientRequestId;
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    }
    const current = { ...run, clientRequestId };
    return String(input).endsWith("/events") ? live(current, init?.signal) : Response.json({ run: clientRequestId ? current : null, activeRuns: clientRequestId ? [current] : [] });
  });
  t.after(() => seen.manager.dispose());
  await seen.manager.connect("session");
  const sending = seen.manager.send({ sessionId: "session", message: "input" });
  await seen.manager.reconnect();
  await sending;
  assert.equal(seen.manager.view.runId, "task");
  assert.equal(seen.manager.view.partial, "first step");
  assert.equal(posts, 1);
  assert.deepEqual(seen.errors, []);
});

test("refresh during new session creation retains input and completion in another session cannot discard it", async (t) => {
  const creation = deferred<Response>();
  const first = setup(async (input) => String(input) === "/api/sessions" ? creation.promise : Response.json({ run: null, activeRuns: [] }));
  await first.manager.connect();
  const sending = first.manager.send({ sessionId: null, message: "new input" });
  const stored = first.values.get("bibo-pending-user")!;
  first.manager.dispose();
  creation.resolve(Response.json({ session: { id: "created", title: "New", createdAt: "now", updatedAt: "now" } }));
  await sending;
  assert.deepEqual(first.created, [], "disposed creation cannot navigate or submit");
  const other = { ...run, phase: "completed" as const };
  const second = setup(async (input) => String(input).endsWith("/events") ? completed(other) : Response.json({ run: null, activeRuns: [{ ...other, phase: "saving" }] }), stored);
  t.after(() => second.manager.dispose());
  await second.manager.connect();
  await until(() => second.commits.length === 1);
  assert.equal(second.errors[0]?.input.message, "new input");
  assert.equal(second.values.has("bibo-pending-user"), true, "another task does not own this input receipt");
});
