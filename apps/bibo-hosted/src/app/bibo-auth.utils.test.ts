import assert from "node:assert/strict";
import test from "node:test";
import { authRoute, currentUser, isPlatformAdmin, sessionUser } from "./bibo-auth.utils";

test("edge administration accepts only a platform-verified admin token", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const token = new Headers(init.headers).get("authorization")?.slice(7);
    requests.push(`${new URL(url).pathname}:${token}`);
    return Response.json({ ok: token === "admin" }, { status: token === "admin" ? 200 : 403 });
  });
  assert.equal(await isPlatformAdmin(null), false);
  assert.equal(await isPlatformAdmin("user"), false);
  assert.equal(await isPlatformAdmin("admin"), true);
  assert.deepEqual(requests, ["/platform/admin/overview:user", "/platform/admin/overview:admin"]);
});

test("verified identity cache is token-bound, expires, respects token expiry and never caches denial", async (t) => {
  const previousCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  const values = new Map<string, Response>();
  const started = Date.now();
  let clock = started;
  let writesFail = false;
  const cache = {
    match: async (request: Request) => values.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => { if (writesFail) throw new Error("cache unavailable"); values.set(request.url, response); },
    delete: async (request: Request) => values.delete(request.url),
  };
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { open: async () => cache } });
  t.after(() => { if (previousCaches) Object.defineProperty(globalThis, "caches", previousCaches); else Reflect.deleteProperty(globalThis, "caches"); });
  t.mock.method(Date, "now", () => clock);
  const token = (id: string, exp = Math.floor(clock / 1000) + 3600) => `nca.${Buffer.from(JSON.stringify({ sub: id, exp })).toString("base64url")}.test`;
  const first = token("first"); const second = token("second");
  const nearExpiry = token("first", Math.floor(clock / 1000) + 1);
  let denied = false;
  let reads = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    reads += 1;
    const bearer = new Headers(init.headers).get("authorization")?.slice(7);
    const id = bearer === second ? "second" : bearer === first || bearer === nearExpiry ? "first" : null;
    return denied || !id ? Response.json({ ok: false }, { status: 401 }) : Response.json({ ok: true, data: { user: { id, email: "private", paidBalanceUsd: 0 } } });
  });
  await t.test("cache is isolated and account/model verification stays fresh", async () => {
  assert.equal((await sessionUser(first))?.id, "first");
  assert.deepEqual(await sessionUser(first), { id: "first" });
  assert.equal(reads, 1);
  assert.equal((await sessionUser(second))?.id, "second");
  assert.equal(await sessionUser(`${first}tampered`), null);
  assert.equal(values.size, 2);
  for (const [key, response] of values) {
    assert.equal(key.includes(first), false, "credential is not stored in a cache URL");
    assert.deepEqual(Object.keys(await response.clone().json()).sort(), ["expiresAt", "id"]);
  }
  assert.equal((await currentUser(first))?.id, "first", "account/model checks remain fresh");
  assert.equal(reads, 4);
  });
  await t.test("identity TTL and credential expiry bound reuse", async () => {
  denied = true; clock += 30_001;
  assert.equal(await sessionUser(first), null, "expired identity must revalidate and reject denial");
  denied = false;
  clock = started;
  assert.equal((await sessionUser(nearExpiry))?.id, "first");
  assert.equal(values.size, 3);
  clock += 1001; denied = true;
  assert.equal(await sessionUser(nearExpiry), null, "cache cannot extend the platform credential expiry");
  });
  await t.test("cache failure falls back and logout removes identity", async () => {
  denied = false; writesFail = true; clock += 30_001;
  assert.equal((await sessionUser(first))?.id, "first", "cache failure preserves a fresh valid login");
  writesFail = false;
  await sessionUser(first);
  const logout = await authRoute(new Request("https://app.bibo.bot/api/auth/logout", { method: "POST", headers: { cookie: `bibo_session=${first}` } }), "/api/auth/logout");
  assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/);
  denied = true;
  assert.equal(await sessionUser(first), null, "logout removes the local cached identity");
  });
});
