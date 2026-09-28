import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { BiboSpaceService, type BiboSpaceState } from "@/features/bibo-domain";
import { BiboSpaceStateStore } from "./bibo-space-state.service";

const bundle = await build({
  entryPoints: [new URL("./bibo-hosted.app.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", write: false,
  plugins: [{
    name: "cloudflare-boundary",
    setup: (plugin) => {
      plugin.onResolve({ filter: /^(@cloudflare\/containers|cloudflare:workers|(?:\.{1,2}\/|@\/app\/)bibo-auth\.utils)$/ }, (args) => ({ path: args.path, namespace: "mock" }));
      plugin.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
        contents: args.path === "cloudflare:workers"
          ? "export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }"
          : args.path === "@cloudflare/containers"
            ? "export class Container { constructor(ctx, env) { this.ctx = ctx; this.env = env; } containerFetch = (...args) => this.env.containerFetch(...args); stop = async () => this.env.stop?.(); } export const getContainer = () => ({ fetch: async () => Response.json({ forwarded: true }) });"
            : "export const currentUser = async () => ({ id: 'user-1' }); export const sessionUser = currentUser; export const cookieToken = () => 'token'; export const authRoute = async () => new Response(); export const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers }); export const publicError = (error, status) => Response.json({ error }, { status });",
      }));
    },
  }],
});

const worker = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString("base64")}`) as {
  BiboUserContainer: new (ctx: object, env: object) => { fetch(request: Request): Promise<Response>; onStart(): Promise<void> };
  BiboModelBudget: new (ctx: object, env: object) => { fetch(request: Request): Promise<Response> };
  default: { fetch(request: Request, env: object): Promise<Response> };
};

const emptySpace = (): BiboSpaceState => ({ schema: 1, tasks: [], projects: [], events: [], files: [], inbox: [], deliveryStatuses: {}, replays: {} });

class PersonalSpaceFixture {
  readonly values: Map<string, unknown>;
  readonly archives = new Map<string, ArrayBuffer>();
  private state = emptySpace();
  private containerCalls = 0;
  private stopCount = 0;
  private snapshotFailed = false;
  private writeFailed = false;
  private runFailed = false;
  private readonly storage = {
    get: async (key: string | string[]) => Array.isArray(key) ? new Map(key.filter((item) => this.values.has(item)).map((item) => [item, structuredClone(this.values.get(item))])) : structuredClone(this.values.get(key)),
    put: async (key: string | Record<string, unknown>, value?: unknown) => {
      if (this.writeFailed) throw new Error("storage unavailable");
      const entries = typeof key === "string" ? [[key, value]] : Object.entries(key);
      for (const [, item] of entries) if (Buffer.byteLength(JSON.stringify(item)) > 2 * 1024 * 1024) throw new Error("KV value exceeds 2 MiB");
      for (const [name, item] of entries) this.values.set(name as string, structuredClone(item));
    },
    delete: async (keys: string[]) => { for (const key of keys) this.values.delete(key); },
    transaction: async (run: (transaction: unknown) => Promise<void>) => run(this.storage),
  };
  private readonly localSpace = new BiboSpaceService("/unused", { load: async () => structuredClone(this.state), save: async (state) => { this.state = structuredClone(state); } });
  readonly env = {
    SNAPSHOTS: {
      get: async (key: string) => this.archives.has(key) ? { body: this.archives.get(key) } : null,
      head: async (key: string) => this.archives.has(key) ? {} : null,
      put: async (key: string, body: ArrayBuffer) => { if (this.snapshotFailed) throw new Error("snapshot unavailable"); this.archives.set(key, body); },
      delete: async (key: string) => { this.archives.delete(key); },
    },
    stop: () => { this.stopCount += 1; },
    containerFetch: async (url: string, init?: RequestInit) => {
      this.containerCalls += 1;
      const route = new URL(url).pathname;
      if (route === "/space/state") {
        if (init?.method === "POST") { this.state = BiboSpaceService.parseState(JSON.parse(init.body as string).state); return Response.json({ ok: true }); }
        return Response.json({ state: this.state });
      }
      if (route === "/restore") { this.state = JSON.parse(new TextDecoder().decode(init!.body as ArrayBuffer)); return Response.json({ ok: true }); }
      if (route === "/snapshot") return new Response(JSON.stringify(this.state));
      if (route === "/space") {
        const { action, input } = JSON.parse(init!.body as string);
        if (action === "inbox.create") return Response.json({ result: await this.localSpace.execute(action, input) });
        return Response.json({ result: { ok: true } });
      }
      if (route === "/run") {
        const task = await this.localSpace.execute("task.create", { title: "Agent task" });
        const sessionId = JSON.parse(init!.body as string).sessionId;
        return this.runFailed ? new Response("run failed", { status: 500 }) : Response.json({ text: "已保存", sessionId, task,
          ...(this.display ? { displayEvents: [{ id: "show-1", sessionId, target: { type: "file", payload: { path: "a.md" } } }] } : {}) });
      }
      if (route === "/sessions/delete") return Response.json({ ok: true });
      throw new Error(`Unexpected container route ${route}`);
    },
  };
  private readonly ctx = { storage: this.storage, id: { toString: () => "account-space" }, waitUntil: (_promise: Promise<unknown>) => {} };
  private owner: InstanceType<typeof worker.BiboUserContainer>;

  constructor(initial?: BiboSpaceState, private readonly display = false) {
    this.values = new Map(initial ? [["spaceState", { chunks: 1 }], ["spaceState:0", JSON.stringify(initial)]] : []);
    this.owner = this.instance();
  }

  private instance = () => new worker.BiboUserContainer(this.ctx, this.env);
  stored = () => new BiboSpaceStateStore(this.storage as unknown as DurableObjectStorage).load();
  action = (action: string, input: Record<string, unknown> = {}) => this.owner.fetch(new Request("https://bibo.internal/space", { method: "POST", body: JSON.stringify({ action, input }) }));
  run = (stream = false) => this.owner.fetch(new Request("https://bibo.internal/run", { method: "POST", ...(stream ? { headers: { accept: "text/event-stream" } } : {}), body: JSON.stringify({ message: "create task", token: "token" }) }));
  ownerFetch = (request: Request) => this.owner.fetch(request);
  cancel = (runId: string) => this.owner.fetch(new Request("https://bibo.internal/cancel", { method: "POST", body: JSON.stringify({ runId }) }));
  restart = async () => { this.owner = this.instance(); await this.owner.onStart(); };
  reopen = () => { this.owner = this.instance(); };
  local = () => this.state;
  calls = () => this.containerCalls;
  stopped = () => this.stopCount;
  failSnapshot = () => { this.snapshotFailed = true; };
  failWrite = () => { this.writeFailed = true; };
  failRun = () => { this.runFailed = true; };
}

const personalSpace = (initial?: BiboSpaceState, display = false) => new PersonalSpaceFixture(initial, display);

test("streamed model rejection preserves code, rolls back, and correlates terminal diagnostics", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "info", (line: string) => logs.push(line));
  t.mock.method(console, "error", (line: string) => logs.push(line));
  const fixture = personalSpace(emptySpace());
  const original = fixture.env.containerFetch;
  fixture.env.containerFetch = async (url: string, init?: RequestInit) => {
    if (new URL(url).pathname !== "/run") return original(url, init);
    const headers = new Headers(init?.headers);
    assert.ok(headers.get("x-bibo-run-id"));
    assert.ok(headers.get("x-bibo-session-id"));
    return new Response('event: error\ndata: {"code":"MODEL_INPUT_TOO_LARGE","status":413,"error":"private-upstream-message"}\n\n', { headers: { "content-type": "text/event-stream" } });
  };
  const response = await fixture.run(true);
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /MODEL_INPUT_TOO_LARGE/);
  assert.ok(!text.includes("private-upstream-message"));
  assert.equal(fixture.archives.size, 0);
  assert.equal(fixture.stopped(), 1);
  const records = logs.map((line) => JSON.parse(line));
  assert.equal(new Set(records.map((record) => record.runId)).size, 1);
  assert.ok(records.some((record) => record.event === "run.failed" && record.status === 413 && record.sessionId));
  assert.ok(records.some((record) => record.event === "run.finished" && record.persisted === false));
});

test("model gateway forwards context above 128 KiB and records only sizes", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "info", (line: string) => logs.push(line));
  let forwarded = false;
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.ok(Buffer.byteLength(String(init?.body)) > 128 * 1024);
    assert.equal(body.messages[0].content.length, 150000);
    forwarded = true;
    return Response.json({ choices: [] });
  });
  const response = await worker.default.fetch(new Request("https://app.bibo.bot/api/model/v1/chat/completions", {
    method: "POST", headers: { authorization: "Bearer private-token", "x-bibo-run-id": "run-long", "x-bibo-session-id": "session-long" },
    body: JSON.stringify({ messages: [{ role: "user", content: "x".repeat(150000) }] }),
  }), { BIBO_DEEPSEEK_API_KEY: "private-api-key", BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: async () => Response.json({ ok: true }) }) } });
  assert.equal(response.status, 200);
  assert.ok(forwarded);
  assert.ok(logs.every((line) => !line.includes("private-") && !line.includes("xxxxx")));
  assert.ok(logs.some((line) => JSON.parse(line).requestBytes > 128 * 1024));
});

test("Worker releases display events only after snapshot commit", async () => {
  const saved = personalSpace(undefined, true);
  const stream = await (await saved.run(true)).text();
  assert.ok(stream.indexOf("event: saving") < stream.indexOf("event: show-content"));
  assert.ok(stream.indexOf("event: show-content") < stream.indexOf("event: committed"));
  assert.ok(saved.archives.size > 0);
  const failed = personalSpace(undefined, true);
  failed.failSnapshot();
  const rejected = await (await failed.run(true)).text();
  assert.ok(rejected.includes("event: error"));
  assert.equal(rejected.includes("event: show-content"), false);
  assert.equal(rejected.includes("event: committed"), false);
});

test("questions and quoted answers commit with the Agent snapshot and survive a new DO instance", async () => {
  const space = personalSpace();
  const original = space.env.containerFetch;
  const prompt = { id: "q-1", messageId: "assistant-question-1", askedAt: "2026-09-29T00:00:00Z", title: "报告格式？",
    options: ["PDF", "DOCX"], recommendedOption: "PDF", optionDescriptions: { PDF: "适合直接交付" }, status: "pending" };
  space.env.containerFetch = async (url, init) => {
    if (new URL(url).pathname !== "/run") return original(url, init);
    const body = JSON.parse(String(init?.body)) as { sessionId: string; questionId?: string; questionAction?: string; message: string };
    if (body.questionId) {
      assert.equal(body.questionId, prompt.id);
      assert.equal(body.questionAction, "answer");
      assert.equal(body.message, "DOCX");
      return Response.json({ text: "已按 DOCX 准备", sessionId: body.sessionId,
        questions: [{ ...prompt, status: "answered", answer: "DOCX" }] });
    }
    return Response.json({ text: "我会先整理内容", sessionId: body.sessionId, questions: [prompt] });
  };
  const first = await (await space.run()).json() as { session: { id: string }; messages: Array<{ questions?: unknown[] }> };
  assert.equal(first.messages.at(-1)?.questions?.length, 1);
  const answer = () => new Request("https://bibo.internal/run", { method: "POST", body: JSON.stringify({
    sessionId: first.session.id, message: "DOCX", token: "token", questionId: "q-1", questionAction: "answer",
  }) });
  const second = await (await space.ownerFetch(answer())).json() as { messages: Array<{ questions?: Array<{ status: string }>; replyToQuestion?: { id: string; title: string; action: string }; text: string }> };
  assert.equal(second.messages.find((message) => message.questions?.length)?.questions?.[0]?.status, "answered");
  assert.deepEqual(second.messages.at(-2)?.replyToQuestion, { id: "q-1", title: "报告格式？", action: "answered" });
  assert.equal(second.messages.at(-1)?.text, "已按 DOCX 准备");
  assert.equal((await space.ownerFetch(answer())).status, 409);
  space.reopen();
  const history = await (await space.ownerFetch(new Request(`https://bibo.internal/history?id=${first.session.id}`))).json() as { messages: typeof second.messages };
  assert.deepEqual(history.messages, second.messages);
});

test("cancelled runs discard their file display requests", async () => {
  const space = personalSpace(undefined, true);
  const originalFetch = space.env.containerFetch;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  space.env.containerFetch = async (url, init) => {
    if (new URL(url).pathname === "/run") await pending;
    return originalFetch(url, init);
  };
  const response = await space.run(true);
  const reader = response.body!.getReader();
  const accepted = new TextDecoder().decode((await reader.read()).value);
  const runId = JSON.parse(accepted.match(/^data: (.+)$/m)![1]!).runId;
  try {
    assert.equal((await space.cancel(runId)).status, 200);
  } finally { release(); }
  let output = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    output += new TextDecoder().decode(chunk.value);
  }
  assert.ok(output.includes("event: error"));
  assert.equal(output.includes("event: show-content"), false);
  assert.equal(output.includes("event: committed"), false);
  assert.equal(space.archives.size, 0);
});

test("structured saves persist without container or snapshots, retain conflicts and idempotence", async () => {
  const space = personalSpace();
  const request = { title: "Fast saved task", requestId: "one" };
  const created = await space.action("task.create", request);
  assert.equal(created.status, 200);
  assert.match(created.headers.get("server-timing")!, /space;dur=/);
  const { result: task } = await created.json() as { result: { id: string; version: number } };
  assert.deepEqual(await (await space.action("task.create", request)).json(), { result: task });
  space.reopen();
  assert.deepEqual(await (await space.action("task.get", { id: task.id })).json(), { result: task });
  assert.equal(space.calls(), 0);
  assert.equal(space.archives.size, 0);
  assert.equal((await space.action("task.update", { id: task.id, version: 0, status: "done" })).status, 409);
  assert.equal(space.stopped(), 0, "a validation failure does not stop an unrelated container");
  space.failWrite();
  assert.equal((await space.action("task.create", { title: "Must not be saved" })).status, 503);
  assert.equal((await space.stored())!.tasks.length, 1);
});

test("snapshot hydration and restarts preserve newer DO tasks and staged inbox writes", async () => {
  const space = personalSpace();
  const old = emptySpace();
  old.tasks.push({ id: "existing", title: "Old task", version: 1 } as BiboSpaceState["tasks"][number]);
  space.values.set("snapshotKey", "old-snapshot");
  space.archives.set("old-snapshot", new TextEncoder().encode(JSON.stringify(old)).buffer as ArrayBuffer);
  await space.restart();
  const created = await space.action("task.create", { title: "After snapshot" });
  assert.equal(created.status, 200);
  assert.equal((await space.stored())!.tasks.length, 2);
  await space.restart();
  assert.equal(space.local().tasks.length, 2, "old snapshot cannot roll back a fast saved task");
  assert.equal((await space.action("inbox.create", { title: "Notice", body: "Body" })).status, 200);
  assert.equal((await space.stored())!.inbox.length, 1);
  assert.equal((await space.stored())!.tasks.length, 2);
  await space.restart();
  assert.equal(space.local().inbox.length, 1);
  space.failSnapshot();
  assert.equal((await space.action("inbox.create", { title: "Not committed", body: "Body" })).status, 503);
  assert.equal((await space.stored())!.inbox.length, 1);
  assert.equal(space.stopped(), 1);
});

test("a missing committed snapshot cannot hydrate an empty authoritative space", async () => {
  const space = personalSpace();
  space.values.set("snapshotKey", "unavailable");
  await assert.rejects(space.restart(), /committed snapshot is unavailable/);
  assert.equal(await space.stored(), undefined);
});

test("structured state beyond one KV value survives save, reopen and shrinking", async () => {
  const space = personalSpace();
  const tasks: Array<{ id: string; version: number }> = [];
  for (let index = 0; index < 40; index += 1) {
    const response = await space.action("task.create", { title: `Large task ${index}`, description: "文".repeat(20_000) });
    assert.equal(response.status, 200);
    tasks.push((await response.json() as { result: { id: string; version: number } }).result);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(await space.stored())) > 2 * 1024 * 1024);
  space.reopen();
  assert.equal((await space.stored())!.tasks.length, 40);
  for (const task of tasks.slice(1)) assert.equal((await space.action("task.delete", task)).status, 200);
  assert.deepEqual(space.values.get("spaceState"), { chunks: 1 });
  assert.equal(space.values.has("spaceState:1"), false, "shrinking removes unused durable chunks");
  assert.equal((await space.stored())!.tasks[0]!.id, tasks[0]!.id);
});

test("chat commits the same structured state and failed chat keeps previous durable writes", async () => {
  const space = personalSpace();
  await space.action("task.create", { title: "UI task" });
  assert.equal((await space.run()).status, 200);
  assert.deepEqual((await space.stored())!.tasks.map((task) => task.title), ["UI task", "Agent task"]);
  space.failRun();
  assert.equal((await space.run()).status, 502);
  assert.equal((await space.stored())!.tasks.length, 2);
  assert.equal(space.stopped(), 1);
});

test("exhausted model budget rejects chat before forwarding without changing the budget", async () => {
  const current = { day: new Date().toISOString().slice(0, 10), total: 2000, users: {} };
  let writes = 0;
  const storage = {
    get: async () => current,
    put: async () => { writes += 1; },
    transaction: async (action: (value: object) => Promise<unknown>) => action(storage),
  };
  const budget = new worker.BiboModelBudget({ storage }, {});
  const env = { BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: (url: string, init: RequestInit) => budget.fetch(new Request(url, init)) }) }, BIBO_USER: {} };
  const check = await worker.default.fetch(new Request("https://app.bibo.bot/api/chat/availability"), env);
  assert.equal(check.status, 429);
  const creation = await worker.default.fetch(new Request("https://app.bibo.bot/api/sessions", {
    method: "POST", headers: { origin: "https://app.bibo.bot" },
  }), env);
  assert.equal(creation.status, 429);
  const response = await worker.default.fetch(new Request("https://app.bibo.bot/api/chat", {
    method: "POST", headers: { origin: "https://app.bibo.bot", "content-type": "application/json" },
    body: JSON.stringify({ message: "创建一个任务" }),
  }), env);
  assert.equal(response.status, 429);
  assert.match((await response.json() as { error: string }).error, /今日试用额度已用完/);
  assert.equal(writes, 0);
});

test("chat permits 100 hourly trial turns and expires the previous hour", async () => {
  const space = personalSpace();
  space.values.set("runs", Array.from({ length: 99 }, () => Date.now()));
  assert.equal((await space.run()).status, 200);
  const limited = await space.run();
  assert.equal(limited.status, 429);
  assert.match((await limited.json() as { error: string }).error, /本小时对话次数已用完/);
  space.values.set("runs", Array.from({ length: 100 }, () => Date.now() - 3_600_001));
  assert.equal((await space.run()).status, 200);
  assert.equal((space.values.get("runs") as number[]).length, 1);
});

test("model reservation permits the experiment allowance and search keeps a separate counter", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const values = new Map<string, unknown>([["budget", { day, total: 249, users: { "user-1": 249 } }]]);
  const storage = {
    get: async (key: string) => structuredClone(values.get(key)),
    put: async (key: string, value: unknown) => { values.set(key, structuredClone(value)); },
    transaction: async (action: (value: object) => Promise<unknown>) => action(storage),
  };
  const budget = new worker.BiboModelBudget({ storage }, {});
  const request = (path: string) => budget.fetch(new Request(`https://bibo.internal/${path}`, { method: "POST", body: JSON.stringify({ userId: "user-1" }) }));
  assert.equal((await request("available")).status, 200);
  assert.equal((await request("reserve")).status, 200);
  assert.equal((await request("available")).status, 429);
  assert.equal((await request("reserve")).status, 429);
  assert.equal((await request("search")).status, 200);
  assert.deepEqual(values.get("budget"), { day, total: 250, users: { "user-1": 250 } });
  assert.equal((values.get("search-budget") as { dailyTotal: number }).dailyTotal, 1);
});

test("available budget forwards valid chat and keeps reservation in the model endpoint", async () => {
  let writes = 0;
  const storage = {
    get: async () => undefined,
    put: async () => { writes += 1; },
    transaction: async (action: (value: object) => Promise<unknown>) => action(storage),
  };
  const budget = new worker.BiboModelBudget({ storage }, {});
  const env = { BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: (url: string, init: RequestInit) => budget.fetch(new Request(url, init)) }) }, BIBO_USER: {} };
  const check = await worker.default.fetch(new Request("https://app.bibo.bot/api/chat/availability"), env);
  assert.equal(check.status, 200);
  const response = await worker.default.fetch(new Request("https://app.bibo.bot/api/chat", {
    method: "POST", headers: { origin: "https://app.bibo.bot", "content-type": "application/json" },
    body: JSON.stringify({ message: "你好" }),
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { forwarded: true });
  assert.equal(writes, 0);
});
