import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { BiboSpaceService, type BiboSpaceState } from "../features/bibo-domain/services/bibo-space.service";
import { BiboSpaceStateStore } from "./bibo-space-state.service";

const bundle = await build({
  entryPoints: [new URL("./bibo-hosted.app.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", write: false,
  plugins: [{
    name: "cloudflare-boundary",
    setup(plugin) {
      plugin.onResolve({ filter: /^(@cloudflare\/containers|cloudflare:workers|\.\/bibo-auth\.utils)$/ }, (args) => ({ path: args.path, namespace: "mock" }));
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

function personalSpace(initial?: BiboSpaceState) {
  const values = new Map<string, unknown>(initial ? [["spaceState", { chunks: 1 }], ["spaceState:0", JSON.stringify(initial)]] : []);
  const archives = new Map<string, ArrayBuffer>();
  let local = emptySpace();
  let containerCalls = 0;
  let stopped = 0;
  let failSnapshot = false;
  let failWrite = false;
  let failRun = false;
  const storage = {
    get: async (key: string | string[]) => Array.isArray(key) ? new Map(key.filter((item) => values.has(item)).map((item) => [item, structuredClone(values.get(item))])) : structuredClone(values.get(key)),
    put: async (key: string | Record<string, unknown>, value?: unknown) => {
      if (failWrite) throw new Error("storage unavailable");
      const entries = typeof key === "string" ? [[key, value]] : Object.entries(key);
      for (const [, item] of entries) if (Buffer.byteLength(JSON.stringify(item)) > 2 * 1024 * 1024) throw new Error("KV value exceeds 2 MiB");
      for (const [name, item] of entries) values.set(name as string, structuredClone(item));
    },
    delete: async (keys: string[]) => { for (const key of keys) values.delete(key); },
    transaction: async (run: (transaction: unknown) => Promise<void>) => run(storage),
  };
  const localSpace = new BiboSpaceService("/unused", { load: async () => structuredClone(local), save: async (state) => { local = structuredClone(state); } });
  const env = {
    SNAPSHOTS: {
      get: async (key: string) => archives.has(key) ? { body: archives.get(key) } : null,
      head: async (key: string) => archives.has(key) ? {} : null,
      put: async (key: string, body: ArrayBuffer) => { if (failSnapshot) throw new Error("snapshot unavailable"); archives.set(key, body); },
      delete: async (key: string) => { archives.delete(key); },
    },
    stop: () => { stopped += 1; },
    containerFetch: async (url: string, init?: RequestInit) => {
      containerCalls += 1;
      const route = new URL(url).pathname;
      if (route === "/space/state") {
        if (init?.method === "POST") { local = BiboSpaceService.parseState(JSON.parse(init.body as string).state); return Response.json({ ok: true }); }
        return Response.json({ state: local });
      }
      if (route === "/restore") { local = JSON.parse(new TextDecoder().decode(init!.body as ArrayBuffer)); return Response.json({ ok: true }); }
      if (route === "/snapshot") return new Response(JSON.stringify(local));
      if (route === "/space") {
        const { action, input } = JSON.parse(init!.body as string);
        if (action === "inbox.create") return Response.json({ result: await localSpace.execute(action, input) });
        return Response.json({ result: { ok: true } });
      }
      if (route === "/run") {
        const task = await localSpace.execute("task.create", { title: "Agent task" });
        return failRun ? new Response("run failed", { status: 500 }) : Response.json({ text: "已保存", sessionId: JSON.parse(init!.body as string).sessionId, task });
      }
      if (route === "/sessions/delete") return Response.json({ ok: true });
      throw new Error(`Unexpected container route ${route}`);
    },
  };
  const ctx = { storage, id: { toString: () => "account-space" } };
  const instance = () => new worker.BiboUserContainer(ctx, env);
  let owner = instance();
  return {
    values, archives, env,
    stored: () => new BiboSpaceStateStore(storage as unknown as DurableObjectStorage).load(),
    action: (action: string, input: Record<string, unknown> = {}) => owner.fetch(new Request("https://bibo.internal/space", { method: "POST", body: JSON.stringify({ action, input }) })),
    run: () => owner.fetch(new Request("https://bibo.internal/run", { method: "POST", body: JSON.stringify({ message: "create task", token: "token" }) })),
    restart: async () => { owner = instance(); await owner.onStart(); },
    reopen: () => { owner = instance(); },
    local: () => local,
    calls: () => containerCalls,
    stopped: () => stopped,
    failSnapshot: () => { failSnapshot = true; },
    failWrite: () => { failWrite = true; },
    failRun: () => { failRun = true; },
  };
}

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
  const current = { day: new Date().toISOString().slice(0, 10), total: 200, users: {} };
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
  const response = await worker.default.fetch(new Request("https://app.bibo.bot/api/chat", {
    method: "POST", headers: { origin: "https://app.bibo.bot", "content-type": "application/json" },
    body: JSON.stringify({ message: "创建一个任务" }),
  }), env);
  assert.equal(response.status, 429);
  assert.match((await response.json() as { error: string }).error, /今日试用额度已用完/);
  assert.equal(writes, 0);
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
