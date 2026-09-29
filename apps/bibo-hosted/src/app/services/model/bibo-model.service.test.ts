import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createBiboModel } from "./bibo-model.service";
import { readRunFailure, runFailure } from "@/app/diagnostics/bibo-diagnostics.utils";

test("edge model uses the existing budget and DeepSeek transport with the Node model tail", async () => {
  const requests: Record<string, unknown>[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push(body);
    if (body.stream) return new Response('data: {"id":"one","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } });
    return Response.json({ choices: [{ message: { content: "summary" }, finish_reason: "stop" }], usage: { prompt_tokens: 8 } });
  });
  try {
    const env = {
      BIBO_DEEPSEEK_API_KEY: "test-key",
      BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: async () => Response.json({ ok: true }) }) },
    } as unknown as Env;
    const model = createBiboModel(env, "test-user", { runId: "test-run" });
    const chunks = [];
    for await (const chunk of model.llmApi.generate({ model: "deepseek/deepseek-flash", messages: [{ role: "user", content: "hi" }] })) chunks.push(chunk);
    assert.equal(chunks[0]?.choices?.[0]?.delta?.content, "hello");
    assert.equal((requests[0]?.messages as Array<{ content: string }>).at(-1)?.content.includes("currentTime"), true);
    const summary = await model.summaryProvider.chat({ model: "deepseek-flash", maxTokens: 128, messages: [{ role: "user", content: "summarize" }], requestId: "summary-1", sessionId: "session-1", thinkingLevel: "off" });
    assert.equal(summary.content, "summary");
    assert.equal(requests[0]?.model, "deepseek-flash");
    assert.equal(requests[1]?.model, "deepseek-flash");
    assert.equal(requests[1]?.max_tokens, 128);
    assert.equal(requests.length, 2);
  } finally { fetchMock.mock.restore(); }
});

test("generation and compaction reject an unconfigured model without charging or silently substituting it", async () => {
  const reserve = mock.fn(async () => Response.json({ ok: true }));
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("upstream must not be called"); });
  try {
    const env = { BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: reserve }) } } as unknown as Env;
    const model = createBiboModel(env, "test-user", { runId: "test-run" });
    await assert.rejects(async () => {
      for await (const _chunk of model.llmApi.generate({ model: "openai/gpt-5", messages: [] })) assert.fail("unexpected chunk");
    }, /BIBO_MODEL_NOT_CONFIGURED/);
    await assert.rejects(model.summaryProvider.chat({ model: "openai/gpt-5", messages: [], maxTokens: 128,
      requestId: "summary", sessionId: "session", thinkingLevel: "off" }), /BIBO_MODEL_NOT_CONFIGURED/);
    assert.equal(reserve.mock.callCount(), 0);
    assert.equal(fetchMock.mock.callCount(), 0);
    const failure = runFailure(new Error("BIBO_MODEL_NOT_CONFIGURED"));
    assert.equal(failure.code, "MODEL_NOT_CONFIGURED");
    assert.equal(readRunFailure(failure).code, failure.code);
  } finally { fetchMock.mock.restore(); }
});

test("edge model distinguishes a spent Bibo trial budget from a retryable upstream rate limit", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("upstream must not be called"); });
  try {
    const env = {
      BIBO_DEEPSEEK_API_KEY: "test-key",
      BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: async () => Response.json({ error: { message: "quota" } }, { status: 429 }) }) },
    } as unknown as Env;
    const model = createBiboModel(env, "test-user", { runId: "test-run" });
    await assert.rejects(async () => {
      for await (const _chunk of model.llmApi.generate({ model: "deepseek-flash", messages: [{ role: "user", content: "hi" }] })) {
        assert.fail("quota rejection yielded a model chunk");
      }
    }, /BIBO_MODEL_QUOTA_EXHAUSTED/);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { fetchMock.mock.restore(); }
});
