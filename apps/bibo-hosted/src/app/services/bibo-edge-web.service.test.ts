import assert from "node:assert/strict";
import test from "node:test";
import { createBiboEdgeWebTools } from "./bibo-edge-web.service";

test("edge web search uses the existing Exa budget and returns source links", async (t) => {
  let reservedFor: string | undefined;
  let upstreamCalls = 0;
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
    upstreamCalls += 1;
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer platform-key");
    return Response.json({ results: [{ title: "Official docs", url: "https://example.com/docs", highlights: ["Evidence"] }] });
  });
  const env = {
    BIBO_EXA_API_KEY: "platform-key",
    BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: async (_url: string, init: RequestInit) => {
      reservedFor = (JSON.parse(String(init.body)) as { userId: string }).userId;
      return Response.json({ ok: true });
    } }) },
  } as unknown as Env;
  const tool = createBiboEdgeWebTools(env, "account-1", "account-token").find((item) => item.name === "web_search")!;
  const result = await tool.execute({ query: "docs", maxResults: 3 }) as string;
  assert.match(result, /Official docs/);
  assert.match(result, /https:\/\/example\.com\/docs/);
  assert.equal(reservedFor, "account-1");
  assert.equal(upstreamCalls, 1);
});
