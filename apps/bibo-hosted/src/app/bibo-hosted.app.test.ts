import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { type BiboSpaceState } from "@/features/bibo-domain";
import { BiboSpaceStateStore } from "./bibo-space-state.service";
import { CloudflareSessionStore } from "./stores/cloudflare-session.store";

const bundle = await build({
  entryPoints: [new URL("./bibo-hosted.app.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", write: false, conditions: ["workerd"],
  tsconfig: new URL("../../tsconfig.json", import.meta.url).pathname,
  plugins: [{
    name: "cloudflare-boundary",
    setup: (plugin) => {
      plugin.onResolve({ filter: /^(@cloudflare\/sandbox|cloudflare:workers|(?:\.{1,2}\/|@\/app\/)bibo-auth\.utils)$/ }, (args) => ({ path: args.path, namespace: "mock" }));
      plugin.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
        contents: args.path === "cloudflare:workers"
          ? "export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }"
          : args.path === "@cloudflare/sandbox"
            ? "export class Sandbox { constructor(ctx) { this.fixture = ctx; } async mountBucket(...args) { await this.fixture.mount(...args); } async exec(command) { return this.fixture.exec(command); } async onStop() { this.fixture.stops++; } async destroy() { this.fixture.destroyed++; } } export class ContainerProxy {} export const getSandbox = (binding) => { binding.onAcquire(); return { exec: async () => ({ exitCode: 0, stdout: '', stderr: '' }), destroy: async () => {} }; };"
            : "export const currentUser = async () => ({ id: 'user-1' }); export const sessionUser = currentUser; export const isPlatformAdmin = async (token) => token === 'admin'; export const cookieToken = () => 'token'; export const authRoute = async () => new Response(); export const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers }); export const publicError = (error, status) => Response.json({ error }, { status });",
      }));
    },
  }],
});

const bundleDirectory = await mkdtemp(join(tmpdir(), "bibo-worker-contract-"));
after(() => rm(bundleDirectory, { recursive: true, force: true }));
const bundlePath = join(bundleDirectory, "worker.mjs");
await writeFile(bundlePath, bundle.outputFiles[0]!.text);
const worker = await import(pathToFileURL(bundlePath).href) as {
  Sandbox: new (ctx: object, env: object) => { mountBucket(bucket: string, path: string, options: { prefix: string }): Promise<void>; onStop(): Promise<void>; destroy(): Promise<void> };
  BiboUserContainer: new (ctx: object, env: object) => { fetch(request: Request): Promise<Response> };
  BiboModelBudget: new (ctx: object, env: object) => { fetch(request: Request): Promise<Response> };
  default: { fetch(request: Request, env: object): Promise<Response> };
};

test("Sandbox mount reuse checks FUSE and expires on stop, destroy and mount failure", async () => {
  let mounts = 0;
  let live = true;
  let failed = false;
  const fixture = { stops: 0, destroyed: 0,
    mount: async () => { mounts++; if (failed) throw new Error("mount unavailable"); live = true; },
    exec: async (command: string) => { assert.equal(command, "mountpoint -q /mnt/bibo-data/1"); return { exitCode: live ? 0 : 1 }; } };
  const sandbox = new worker.Sandbox(fixture, {});
  const mount = () => sandbox.mountBucket("SNAPSHOTS", "/mnt/bibo-data/1", { prefix: "/user/workspace/" });
  await Promise.all([mount(), mount()]);
  assert.equal(mounts, 1);
  await mount();
  assert.equal(mounts, 1);
  live = false;
  await mount();
  assert.equal(mounts, 2);
  await sandbox.onStop();
  failed = true;
  await assert.rejects(mount(), /mount unavailable/);
  failed = false;
  await mount();
  assert.equal(mounts, 4);
  await sandbox.destroy();
  await mount();
  assert.equal(mounts, 5);
  assert.equal(fixture.stops, 1);
  assert.equal(fixture.destroyed, 1);
});

test("a mount completing after Sandbox stop cannot refill the lifetime cache", async () => {
  let finish!: () => void;
  let mounts = 0;
  const fixture = { stops: 0, destroyed: 0,
    mount: async () => { mounts++; if (mounts === 1) await new Promise<void>((resolve) => { finish = resolve; }); },
    exec: async () => ({ exitCode: 0 }) };
  const sandbox = new worker.Sandbox(fixture, {});
  const mount = () => sandbox.mountBucket("SNAPSHOTS", "/mnt/bibo-data/1", { prefix: "/user/workspace/" });
  const first = mount();
  await sandbox.onStop();
  finish();
  await first;
  await mount();
  assert.equal(mounts, 2);
});

const emptySpace = (): BiboSpaceState => ({ schema: 1, tasks: [], projects: [], events: [], files: [], inbox: [], deliveryStatuses: {}, replays: {} });

const modelText = (content = "已保存") => new Response(`data: ${JSON.stringify({ id: "reply", choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
const modelTool = (name: string, input: unknown) => new Response(`data: ${JSON.stringify({ id: "call", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: crypto.randomUUID(), function: { name, arguments: JSON.stringify(input) } }] }, finish_reason: "tool_calls" }] })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });

beforeEach((t) => {
  if ("mock" in t) t.mock.method(globalThis, "fetch", async () => modelText());
});

class PersonalSpaceFixture {
  readonly values: Map<string, unknown>;
  readonly archives = new Map<string, ArrayBuffer>();
  readonly objectMetadata = new Map<string, { etag: string; uploaded: Date;
    httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }>();
  private objectRevision = 0;
  private sandboxCalls = 0;
  private writeFailed = false;
  private transactions: Promise<void> = Promise.resolve();
  private readonly storage = {
    get: async (key: string | string[]) => Array.isArray(key) ? new Map(key.filter((item) => this.values.has(item)).map((item) => [item, structuredClone(this.values.get(item))])) : structuredClone(this.values.get(key)),
    put: async (key: string | Record<string, unknown>, value?: unknown) => {
      if (this.writeFailed) throw new Error("storage unavailable");
      const entries = typeof key === "string" ? [[key, value]] : Object.entries(key);
      for (const [, item] of entries) if (Buffer.byteLength(JSON.stringify(item)) > 2 * 1024 * 1024) throw new Error("KV value exceeds 2 MiB");
      for (const [name, item] of entries) this.values.set(name as string, structuredClone(item));
    },
    delete: async (keys: string | string[]) => { for (const key of typeof keys === "string" ? [keys] : keys) this.values.delete(key); },
    list: async (options: { prefix: string }) => new Map([...this.values].filter(([key]) => key.startsWith(options.prefix))),
    transaction: (run: (transaction: unknown) => Promise<unknown>): Promise<unknown> => {
      const result = this.transactions.then(() => run(this.storage));
      this.transactions = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  readonly env = {
    BIBO_SANDBOX: { onAcquire: () => { this.sandboxCalls += 1; } },
    BIBO_DEEPSEEK_API_KEY: "test-key",
    BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: async () => Response.json({ ok: true }) }) },
    SNAPSHOTS: {
      get: async (key: string, options?: { range?: { offset: number; length?: number } }) => this.archives.has(key) ? {
        key, size: this.archives.get(key)!.byteLength, ...this.objectMetadata.get(key),
        body: key.includes("/workspace/") ? new Blob([this.archives.get(key)!.slice(options?.range?.offset ?? 0,
          options?.range?.length === undefined ? undefined :
            (options.range.offset + options.range.length))]).stream() : this.archives.get(key),
        text: async () => new TextDecoder().decode(this.archives.get(key)),
      } : null,
      head: async (key: string) => this.archives.has(key)
        ? { key, size: this.archives.get(key)!.byteLength, ...this.objectMetadata.get(key) } : null,
      put: async (key: string, body: ArrayBuffer | Uint8Array | string,
        options?: { onlyIf?: { etagMatches: string }; httpMetadata?: { contentType?: string };
          customMetadata?: Record<string, string> }) => {
        if (options?.onlyIf && this.objectMetadata.get(key)?.etag !== options.onlyIf.etagMatches) return null;
        const bytes = typeof body === "string" ? new TextEncoder().encode(body) :
          body instanceof Uint8Array ? body : new Uint8Array(body);
        this.archives.set(key, bytes.slice().buffer);
        const metadata = { etag: String(++this.objectRevision), uploaded: new Date(),
          httpMetadata: options?.httpMetadata, customMetadata: options?.customMetadata };
        this.objectMetadata.set(key, metadata);
        return { key, size: bytes.byteLength, ...metadata };
      },
      list: async ({ prefix, delimiter, cursor, limit = 1_000 }: {
        prefix: string; delimiter?: string; cursor?: string; limit?: number;
      }) => {
        const keys = [...this.archives.keys()].filter((key) => key.startsWith(prefix)).sort();
        const candidates = new Map<string, "file" | "directory">();
        for (const key of keys) {
          const rest = key.slice(prefix.length);
          const slash = delimiter ? rest.indexOf(delimiter) : -1;
          if (slash >= 0) candidates.set(prefix + rest.slice(0, slash + 1), "directory");
          else candidates.set(key, "file");
        }
        const filtered = [...candidates.keys()].sort().filter((key) => !cursor || key > cursor);
        const selected = filtered.slice(0, limit);
        return { objects: selected.filter((key) => candidates.get(key) === "file").map((key) =>
          ({ key, size: this.archives.get(key)!.byteLength, ...this.objectMetadata.get(key) })),
          delimitedPrefixes: selected.filter((key) => candidates.get(key) === "directory"),
          truncated: filtered.length > selected.length, cursor: selected.at(-1) ?? "" };
      },
      delete: async (key: string | string[]) => {
        for (const item of typeof key === "string" ? [key] : key) {
          this.archives.delete(item);
          this.objectMetadata.delete(item);
        }
      },
    },
  };
  private readonly ctx = { storage: this.storage, id: { toString: () => "account-space" }, waitUntil: (_promise: Promise<unknown>) => {} };
  private owner: InstanceType<typeof worker.BiboUserContainer>;

  constructor(initial?: BiboSpaceState) {
    this.values = new Map((initial ? [["spaceState", { chunks: 1 }], ["spaceState:0", JSON.stringify(initial)]] : []) as Array<[string, unknown]>);
    this.owner = this.instance();
  }

  private instance = () => new worker.BiboUserContainer(this.ctx, this.env);
  importSession = (record: Parameters<CloudflareSessionStore["importSessionSnapshot"]>[0]) => new CloudflareSessionStore(this.storage as unknown as DurableObjectStorage).importSessionSnapshot(record);
  stored = () => new BiboSpaceStateStore(this.storage as unknown as DurableObjectStorage).load();
  action = (action: string, input: Record<string, unknown> = {}) => this.owner.fetch(new Request("https://bibo.internal/space", { method: "POST", body: JSON.stringify({ action, input }) }));
  createSession = () => this.owner.fetch(new Request("https://bibo.internal/sessions/new", { method: "POST" }));
  run = (stream = false) => this.owner.fetch(new Request("https://bibo.internal/run", { method: "POST", ...(stream ? { headers: { accept: "text/event-stream" } } : {}), body: JSON.stringify({ message: "create task", token: "token", userId: "user-1" }) }));
  ownerFetch = (request: Request) => this.owner.fetch(request);
  cancel = (runId: string) => this.owner.fetch(new Request("https://bibo.internal/cancel", { method: "POST", body: JSON.stringify({ runId }) }));
  restart = async () => { this.owner = this.instance(); };
  reopen = () => { this.owner = this.instance(); };
  calls = () => this.sandboxCalls;
  failWrite = () => { this.writeFailed = true; };
}

const personalSpace = (initial?: BiboSpaceState) => new PersonalSpaceFixture(initial);

test("workspace downloads use the authenticated account and preserve original bytes without Sandbox", async () => {
  const space = personalSpace();
  const content = "原文件\n\u0000binary";
  const created = await space.action("file.create", { path: "原文件.txt", kind: "document", content });
  assert.equal(created.status, 200);
  const env = { BIBO_USER: { getByName: (name: string) => {
    assert.equal(name, "user:user-1");
    return { fetch: (url: string) => space.ownerFetch(new Request(url)) };
  } } };
  const response = await worker.default.fetch(new Request(`https://app.bibo.bot/api/workspace/file?path=${encodeURIComponent("原文件.txt")}`), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new TextEncoder().encode(content));
  assert.equal((await worker.default.fetch(new Request("https://app.bibo.bot/api/workspace/file?path=/etc/passwd"), env)).status, 400);
  assert.equal(space.calls(), 0);
});

test("removed conversation mode switching has no administrative endpoint", async () => {
  const env = { BIBO_EDGE_ADMIN_TOKEN: "operator-token" };
  const invoke = (token: string, userId: unknown, origin = "https://app.bibo.bot") => worker.default.fetch(
    new Request("https://app.bibo.bot/api/admin/edge/migrate", {
      method: "POST", headers: { origin, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    }), env);
  assert.equal((await invoke("user", "user-1")).status, 403);
  assert.equal((await invoke("admin", "user-1", "https://other.example")).status, 403);
  assert.equal((await invoke("admin", "../user-1")).status, 404);
  assert.equal((await invoke("admin", "user-1")).status, 404);
  assert.equal((await invoke("operator-token", "user-1")).status, 404);
});

test("model budget operations use the same operator gate", async () => {
  const env = { BIBO_EDGE_ADMIN_TOKEN: "operator-token", BIBO_MODEL_BUDGET: {
    getByName: () => ({ fetch: async (url: string) => Response.json({ operation: new URL(url).pathname }) }),
  } };
  const invoke = (token: string) => worker.default.fetch(new Request("https://app.bibo.bot/api/admin/edge/model-budget-status", {
    method: "POST", headers: { origin: "https://app.bibo.bot", authorization: `Bearer ${token}`,
      "content-type": "application/json" }, body: JSON.stringify({ userId: "user-1" }),
  }), env);
  assert.equal((await invoke("user")).status, 403);
  assert.deepEqual(await (await invoke("operator-token")).json(), { operation: "/admin/status" });
});

test("edge chat commits a reply without invoking the user container", async (t) => {
  const fixture = personalSpace();
  fixture.values.delete("conversationMode");
  Object.assign(fixture.env, {
    BIBO_DEEPSEEK_API_KEY: "test-key",
    BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: async () => Response.json({ ok: true }) }) },
  });
  t.mock.method(globalThis, "fetch", async () => new Response(
    'data: {"id":"edge-1","choices":[{"index":0,"delta":{"content":"边缘回复。"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    { headers: { "content-type": "text/event-stream" } },
  ));
  const created = await fixture.createSession();
  const { session } = await created.json() as { session: { id: string } };
  const response = await fixture.ownerFetch(new Request("https://bibo.internal/run", {
    method: "POST", headers: { accept: "text/event-stream" },
    body: JSON.stringify({ message: "早上好", token: "test-token", userId: "user-1", sessionId: session.id,
      clientRequestId: "same-send-1" }),
  }));
  const stream = await response.text();
  assert.equal(response.status, 200);
  assert.match(stream, /event: committed/);
  assert.equal(fixture.calls(), 0);
  assert.equal(fixture.values.has("conversationMode"), false, "one conversation path needs no mode switch");
  assert.equal(fixture.values.has(`ncpSession:${session.id}`), true);
  const duplicate = await fixture.ownerFetch(new Request("https://bibo.internal/run", {
    method: "POST", body: JSON.stringify({ message: "早上好", token: "test-token", userId: "user-1",
      sessionId: session.id, clientRequestId: "same-send-1" }),
  }));
  assert.equal(duplicate.status, 409, "a retried committed request must not generate a second turn");
  fixture.reopen();
  const history = await fixture.ownerFetch(new Request(`https://bibo.internal/history?id=${session.id}`));
  assert.deepEqual((await history.json() as { messages: Array<{ text: string }> }).messages.map((message) => message.text), ["早上好", "边缘回复。"]);
  const createdFile = await fixture.action("file.create", { path: "hello.md", kind: "note", content: "旧会话可读的新文件" });
  assert.equal(createdFile.status, 200);
  const file = await fixture.action("file.get", { path: "hello.md" });
  assert.equal(file.status, 200, await file.clone().text());
  assert.equal((await file.json() as { result: { content: string } }).result.content, "旧会话可读的新文件");
  assert.equal(fixture.calls(), 0);
  const deleted = await fixture.ownerFetch(new Request("https://bibo.internal/sessions/delete", {
    method: "POST", body: JSON.stringify({ id: session.id }),
  }));
  assert.equal(deleted.status, 200);
  assert.equal(fixture.values.has(`ncpSession:${session.id}`), false);
  assert.equal(fixture.values.has(`sessionHead:${session.id}`), false);
  assert.equal([...fixture.values.keys()].some((key) => key.startsWith(`sessionTail:${session.id}:`)), false);
  assert.equal(fixture.calls(), 0);
});

test("imported canonical history continues through Harness without a container", async (t) => {
  const space = personalSpace();
  const { session } = await (await space.createSession()).json() as { session: { id: string } };
  const at = "2026-09-29T00:00:00Z";
  await space.importSession({ sessionId: session.id, updatedAt: at, messages: [
    { id: "old-user", sessionId: session.id, role: "user", status: "final", timestamp: at, parts: [{ type: "text", text: "旧问题" }] },
    { id: "old-assistant", sessionId: session.id, role: "assistant", status: "final", timestamp: at, parts: [{ type: "text", text: "旧回答" }] },
  ] });
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    assert.match(String(init?.body), /旧问题/);
    assert.match(String(init?.body), /旧回答/);
    return modelText("新回答");
  });
  const response = await space.ownerFetch(new Request("https://bibo.internal/run", { method: "POST",
    body: JSON.stringify({ sessionId: session.id, message: "接着说", token: "token", userId: "user-1" }) }));
  assert.equal(response.status, 200, await response.clone().text());
  space.reopen();
  const history = await (await space.ownerFetch(new Request("https://bibo.internal/history?id=" + session.id))).json() as { messages: Array<{ text: string }> };
  assert.deepEqual(history.messages.map((m) => m.text), ["旧问题", "旧回答", "接着说", "新回答"]);
  assert.equal(space.calls(), 0);
});

test("streamed model rejection preserves code, rolls back, and correlates terminal diagnostics", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "info", (line: string) => logs.push(line));
  t.mock.method(console, "error", (line: string) => logs.push(line));
  const fixture = personalSpace(emptySpace());
  t.mock.method(globalThis, "fetch", async () => new Response("private-upstream-message", { status: 413 }));
  const response = await fixture.run(true);
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /MODEL_INPUT_TOO_LARGE/);
  assert.ok(!text.includes("private-upstream-message"));
  assert.equal(fixture.archives.size, 0);
  assert.equal(fixture.calls(), 0);
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

test("Worker releases display events only after durable commit", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls % 2 === 1
    ? modelTool("show_file", { path: "/data/workspace/a.md", viewer: "source" }) : modelText());
  const saved = personalSpace();
  await saved.action("file.create", { path: "a.md", kind: "note", content: "saved file" });
  const stream = await (await saved.run(true)).text();
  assert.ok(stream.indexOf("event: saving") >= 0, stream);
  assert.ok(stream.indexOf("event: saving") < stream.indexOf("event: show-content"), stream);
  assert.ok(stream.indexOf("event: show-content") < stream.indexOf("event: committed"), stream);
  const failed = personalSpace();
  await failed.action("file.create", { path: "a.md", kind: "note", content: "saved file" });
  calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++calls === 1) return modelTool("show_file", { path: "/data/workspace/a.md", viewer: "source" });
    failed.failWrite();
    return modelText();
  });
  const rejected = await (await failed.run(true)).text();
  assert.ok(rejected.includes("event: error"), rejected);
  assert.equal(rejected.includes("event: show-content"), false);
  assert.equal(rejected.includes("event: committed"), false);
});

test("questions and quoted answers persist through Harness and a new DO instance", async (t) => {
  const space = personalSpace();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls === 1
    ? modelTool("request_user_input_async", { questions: [{ title: "报告格式？", options: ["PDF", "DOCX"], recommendedOption: "PDF" }] })
    : modelText(calls === 2 ? "请选格式。" : "已按 DOCX 准备"));
  const first = await (await space.run()).json() as { session: { id: string }; messages: Array<{ questions?: Array<{ id: string }> }> };
  const questions = first.messages.flatMap((message) => message.questions ?? []);
  assert.equal(questions.length, 1);
  const id = questions[0]!.id;
  const answer = () => new Request("https://bibo.internal/run", { method: "POST", body: JSON.stringify({
    sessionId: first.session.id, message: "DOCX", token: "token", userId: "user-1", questionId: id, questionAction: "answer",
  }) });
  const second = await (await space.ownerFetch(answer())).json() as { messages: Array<{ questions?: Array<{ status: string }>; replyToQuestion?: { id: string; title: string; action: string }; text: string }> };
  assert.equal(second.messages.find((message) => message.questions?.length)?.questions?.[0]?.status, "answered");
  assert.deepEqual(second.messages.at(-2)?.replyToQuestion, { id, title: "报告格式？", action: "answered" });
  assert.equal(second.messages.at(-1)?.text, "已按 DOCX 准备");
  assert.equal((await space.ownerFetch(answer())).status, 409);
  space.reopen();
  const history = await (await space.ownerFetch(new Request("https://bibo.internal/history?id=" + first.session.id))).json() as { messages: typeof second.messages };
  assert.deepEqual(history.messages, second.messages);
});

test("cancelled runs release the run gate and never publish a committed reply", async (t) => {
  const space = personalSpace();
  let entered!: () => void;
  const generating = new Promise<void>((resolve) => { entered = resolve; });
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    entered();
    await new Promise<void>((_resolve, reject) => {
      const abort = () => reject(init?.signal?.reason ?? new Error("aborted"));
      if (init?.signal?.aborted) abort();
      else init?.signal?.addEventListener("abort", abort, { once: true });
    });
    return modelText();
  });
  const response = await space.run(true);
  const reader = response.body!.getReader();
  const accepted = new TextDecoder().decode((await reader.read()).value);
  const runId = JSON.parse(accepted.match(/^data: (.+)$/m)![1]!).runId;
  await generating;
  assert.equal((await space.cancel(runId)).status, 200);
  let output = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    output += new TextDecoder().decode(chunk.value);
  }
  assert.ok(output.includes("event: error"), output);
  assert.equal(output.includes("event: show-content"), false);
  assert.equal(output.includes("event: committed"), false);
  t.mock.method(globalThis, "fetch", async () => modelText("恢复后回复"));
  assert.equal((await space.run()).status, 200);
  assert.equal(space.calls(), 0);
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
  assert.equal(space.calls(), 0, "validation must not acquire a container");
  space.failWrite();
  assert.equal((await space.action("task.create", { title: "Must not be saved" })).status, 503);
  assert.equal((await space.stored())!.tasks.length, 1);
});

test("UI reads and writes remain available while the model is generating", async (t) => {
  const space = personalSpace();
  let entered!: () => void;
  let release!: () => void;
  const generating = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  t.mock.method(globalThis, "fetch", async () => { entered(); await gate; return modelText(); });
  const run = space.run();
  await generating;
  try {
    assert.equal((await space.action("task.list")).status, 200);
    assert.equal((await space.action("file.list")).status, 200);
    assert.equal((await space.action("overview.get")).status, 200);
    assert.equal((await space.action("task.create", { title: "During generation" })).status, 200);
  } finally { release(); }
  assert.equal((await run).status, 200);
  assert.equal((await space.action("task.create", { title: "After chat" })).status, 200);
  assert.deepEqual((await space.stored())!.tasks.map((task) => task.title), ["During generation", "After chat"]);
  assert.equal(space.calls(), 0);
});

test("a slow conversation does not block another conversation or lose either history", async (t) => {
  const space = personalSpace();
  const first = await (await space.createSession()).json() as { session: { id: string } };
  const second = await (await space.createSession()).json() as { session: { id: string } };
  let entered!: () => void;
  let release!: () => void;
  const generating = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    if (String(init?.body).includes("slow-message")) { entered(); await gate; return modelText("slow reply"); }
    return modelText("fast reply");
  });
  const send = (id: string, message: string) => space.ownerFetch(new Request("https://bibo.internal/run", {
    method: "POST", body: JSON.stringify({ sessionId: id, message, token: "token", userId: "user-1" }),
  }));
  const slow = send(first.session.id, "slow-message");
  await generating;
  try {
    const fast = await send(second.session.id, "fast-message");
    assert.equal(fast.status, 200, await fast.clone().text());
    assert.equal((await fast.json() as { text: string }).text, "fast reply");
    assert.equal((await send(first.session.id, "duplicate")).status, 429, "only the genuinely running session is occupied");
    assert.equal((await space.createSession()).status, 200, "new conversations do not tear down running Harness state");
  } finally { release(); }
  assert.equal((await slow).status, 200);
  space.reopen();
  for (const [id, answer] of [[first.session.id, "slow reply"], [second.session.id, "fast reply"]]) {
    const history = await (await space.ownerFetch(new Request("https://bibo.internal/history?id=" + id))).json() as { messages: Array<{ text: string }> };
    assert.equal(history.messages.at(-1)?.text, answer);
  }
  assert.equal(space.calls(), 0);
});

test("DO restarts preserve tasks and inbox without reading stale container snapshots", async () => {
  const space = personalSpace(emptySpace());
  space.values.set("snapshotKey", "old-snapshot");
  space.archives.set("old-snapshot", new TextEncoder().encode(JSON.stringify(emptySpace())).buffer as ArrayBuffer);
  assert.equal((await space.action("task.create", { title: "After snapshot" })).status, 200);
  await space.restart();
  assert.equal((await space.stored())!.tasks.length, 1);
  assert.equal((await space.action("inbox.create", { title: "Notice", body: "Body" })).status, 200);
  await space.restart();
  assert.equal((await space.stored())!.inbox.length, 1);
  assert.equal((await space.stored())!.tasks.length, 1);
  space.failWrite();
  assert.equal((await space.action("inbox.create", { title: "Not committed", body: "Body" })).status, 503);
  assert.equal((await space.stored())!.inbox.length, 1);
  assert.equal(space.calls(), 0);
});

test("missing canonical state chunks fail closed instead of showing an empty space", async () => {
  const space = personalSpace();
  space.values.set("spaceState", { chunks: 1 });
  await space.restart();
  assert.equal((await space.action("task.list")).status, 500);
  await assert.rejects(space.stored(), /个人空间数据不完整/);
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

test("Harness tools and UI share structured state and model failure preserves prior writes", async (t) => {
  const space = personalSpace();
  await space.action("task.create", { title: "UI task" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls === 1
    ? modelTool("bibo", { operation: "call", action: "task.create", input: { title: "Agent task" } }) : modelText());
  const result = await space.run();
  assert.equal(result.status, 200, await result.clone().text());
  assert.deepEqual((await space.stored())!.tasks.map((task) => task.title), ["UI task", "Agent task"]);
  t.mock.method(globalThis, "fetch", async () => new Response("private failure", { status: 413 }));
  assert.equal((await space.run()).status, 413);
  assert.equal((await space.stored())!.tasks.length, 2);
  assert.equal(space.calls(), 0);
});

test("successful Agent mutations survive a later model failure and remain visible to UI", async (t) => {
  const space = personalSpace();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls === 1
    ? modelTool("bibo", { operation: "call", action: "task.create", input: { title: "Durable before reply" } })
    : new Response("model input rejected", { status: 413 }));
  const response = await space.run();
  assert.equal(response.status, 413);
  space.reopen();
  assert.equal((await space.action("task.list")).status, 200);
  assert.deepEqual((await space.stored())!.tasks.map((task) => task.title), ["Durable before reply"]);
  assert.equal(space.calls(), 0);
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
  const env = { BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: (url: string, init: RequestInit) => budget.fetch(new Request(url, init)) }) }, BIBO_USER: { getByName: () => ({ fetch: async () => { throw new Error("exhausted budget must not forward"); } }) } };
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

test("operator can inspect and reset one test user's model allowance without erasing global usage", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const values = new Map<string, unknown>([["budget", { day, total: 300, users: { "user-1": 250, "user-2": 50 } }]]);
  const storage = {
    get: async (key: string) => structuredClone(values.get(key)),
    put: async (key: string, value: unknown) => { values.set(key, structuredClone(value)); },
    transaction: async (action: (value: object) => Promise<unknown>) => action(storage),
  };
  const budget = new worker.BiboModelBudget({ storage }, { BIBO_EDGE_ADMIN_TOKEN: "operator-token" });
  const call = (path: string, token?: string) => budget.fetch(new Request(`https://bibo.internal/admin/${path}`, {
    method: "POST", headers: token ? { "x-bibo-admin-token": token } : {}, body: JSON.stringify({ userId: "user-1" }),
  }));
  assert.equal((await call("status")).status, 403);
  assert.deepEqual(await (await call("status", "operator-token")).json(), {
    day, total: 300, userCalls: 250, totalLimit: 2000, userLimit: 250,
  });
  assert.deepEqual(await (await call("reset-user", "operator-token")).json(), { ok: true, resetCalls: 250 });
  assert.deepEqual(values.get("budget"), { day, total: 300, users: { "user-1": 0, "user-2": 50 } });
});

test("available budget forwards valid chat and keeps reservation in the model endpoint", async () => {
  let writes = 0;
  const storage = {
    get: async () => undefined,
    put: async () => { writes += 1; },
    transaction: async (action: (value: object) => Promise<unknown>) => action(storage),
  };
  const budget = new worker.BiboModelBudget({ storage }, {});
  const env = { BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: (url: string, init: RequestInit) => budget.fetch(new Request(url, init)) }) }, BIBO_USER: { getByName: () => ({ fetch: async (_url: string, init: RequestInit) => {
    assert.equal(JSON.parse(String(init.body)).userId, "user-1");
    return Response.json({ forwarded: true });
  } }) } };
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
