import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

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
            ? "export class Container {} export const getContainer = () => ({ fetch: async () => Response.json({ forwarded: true }) });"
            : "export const currentUser = async () => ({ id: 'user-1' }); export const cookieToken = () => 'token'; export const authRoute = async () => new Response(); export const json = (value, status = 200) => Response.json(value, { status }); export const publicError = (error, status) => Response.json({ error }, { status });",
      }));
    },
  }],
});

const worker = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString("base64")}`) as {
  BiboModelBudget: new (ctx: object, env: object) => { fetch(request: Request): Promise<Response> };
  default: { fetch(request: Request, env: object): Promise<Response> };
};

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
