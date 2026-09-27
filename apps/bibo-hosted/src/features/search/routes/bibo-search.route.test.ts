import assert from "node:assert/strict";
import test from "node:test";
import { biboSearchRoute, reserveBiboSearch } from "./bibo-search.route";

function storageFixture() {
  const values = new Map<string, unknown>();
  let queue = Promise.resolve();
  const storage = {
    transaction: async (operation: (transaction: unknown) => Promise<unknown>) => {
      const pending = queue.then(() => operation({
        get: async (key: string) => structuredClone(values.get(key)),
        put: async (key: string, value: unknown) => { values.set(key, structuredClone(value)); },
      }));
      queue = pending.then(() => undefined, () => undefined);
      return pending;
    },
  } as unknown as DurableObjectStorage;
  return { storage, values };
}

test("atomic search budget isolates model usage and enforces user, daily and monthly limits", async () => {
  const { storage, values } = storageFixture();
  const day = new Date("2026-09-27T12:00:00Z");
  values.set("budget", { total: 200 });
  const concurrent = await Promise.all(Array.from({ length: 120 }, () => reserveBiboSearch(storage, "user-1", day)));
  assert.equal(concurrent.filter((response) => response.ok).length, 100);
  assert.deepEqual(values.get("budget"), { total: 200 });
  for (let user = 2; user <= 10; user += 1) {
    for (let call = 0; call < 100; call += 1) assert.equal((await reserveBiboSearch(storage, `user-${user}`, day)).status, 200);
  }
  assert.equal((await reserveBiboSearch(storage, "user-11", day)).status, 429);
  assert.equal((await reserveBiboSearch(storage, "user-1", new Date("2026-09-28T00:00:00Z"))).status, 200);
  const saved = values.get("search-budget") as Record<string, unknown>;
  assert.equal(saved.monthlyTotal, 1001);
  values.set("search-budget", { ...saved, monthlyTotal: 10_000 });
  const limited = await reserveBiboSearch(storage, "user-1", new Date("2026-09-29T00:00:00Z"));
  assert.equal(limited.status, 429);
  assert.match(await limited.text(), /本月/);
  assert.equal((await reserveBiboSearch(storage, "user-1", new Date("2026-10-01T00:00:00Z"))).status, 200);
  assert.equal((values.get("search-budget") as Record<string, unknown>).monthlyTotal, 1);
});

test("search proxy authenticates, bounds costs, formats errors and protects the platform key", async (t) => {
  const upstreamCalls: { url: string; init?: RequestInit }[] = [];
  let reservations = 0;
  let reservationStatus = 200;
  let upstreamStatus = 200;
  let failNetwork = false;
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    upstreamCalls.push({ url, init });
    if (failNetwork) throw new Error("network failure with platform-secret");
    return Response.json(upstreamStatus === 200 ? {
      requestId: "exa-test-request", results: [{ title: "Official docs", url: "https://example.com/docs", highlights: ["Useful evidence."] }],
    } : { message: "private upstream diagnostic platform-secret" }, { status: upstreamStatus });
  });
  const env = {
    BIBO_EXA_API_KEY: "platform-secret",
    BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: async (_url: string, init: RequestInit) => {
      assert.deepEqual(JSON.parse(String(init.body)), { userId: "verified-user" });
      reservations += 1;
      return Response.json({ message: "search limit" }, { status: reservationStatus });
    } }) },
  } as unknown as Parameters<typeof biboSearchRoute>[1];
  const authenticate = async (token: string | null) => token === "account-token" ? { id: "verified-user" } : null;
  const request = (body: unknown, token = "account-token") => new Request("https://app.bibo.bot/api/search/exa", {
    method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  assert.equal((await biboSearchRoute(request({ query: "docs" }, "invalid"), env, authenticate)).status, 401);
  assert.equal((await biboSearchRoute(request({ query: "docs" }), { ...env, BIBO_EXA_API_KEY: undefined }, authenticate)).status, 503);
  for (const body of [null, { query: "" }, { query: "x".repeat(2001) }, { query: "docs", numResults: 50 }, { query: "docs", numResults: 1.5 }]) {
    assert.equal((await biboSearchRoute(request(body), env, authenticate)).status, 400);
  }
  assert.equal((await biboSearchRoute(request({ query: "x".repeat(9000) }), env, authenticate)).status, 413);
  assert.equal(reservations, 0);
  const authenticationFailure = await biboSearchRoute(request({ query: "docs" }), env, async () => { throw new Error("private authentication diagnostic"); });
  assert.equal(authenticationFailure.status, 503);
  assert.doesNotMatch(await authenticationFailure.text(), /private authentication/);
  const success = await biboSearchRoute(request({ query: " docs ", type: "deep", contents: { summary: true }, userId: "forged" }), env, authenticate);
  assert.equal(success.status, 200);
  assert.match(await success.text(), /Useful evidence/);
  assert.equal(upstreamCalls[0]?.url, "https://api.exa.ai/search");
  assert.equal(new Headers(upstreamCalls[0]?.init?.headers).get("authorization"), "Bearer platform-secret");
  assert.deepEqual(JSON.parse(String(upstreamCalls[0]?.init?.body)), { query: "docs", type: "auto", contents: { highlights: true } });
  await biboSearchRoute(request({ query: "docs", numResults: 3 }), env, authenticate);
  assert.equal(JSON.parse(String(upstreamCalls[1]?.init?.body)).numResults, 3);
  reservationStatus = 429;
  assert.equal((await biboSearchRoute(request({ query: "docs" }), env, authenticate)).status, 429);
  assert.equal(upstreamCalls.length, 2);
  reservationStatus = 200;
  upstreamStatus = 401;
  const failure = await biboSearchRoute(request({ query: "docs" }), env, authenticate);
  assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /platform-secret|private upstream/);
  failNetwork = true;
  const timeout = await biboSearchRoute(request({ query: "docs" }), env, authenticate);
  assert.equal(timeout.status, 503);
  assert.doesNotMatch(await timeout.text(), /platform-secret/);
});
