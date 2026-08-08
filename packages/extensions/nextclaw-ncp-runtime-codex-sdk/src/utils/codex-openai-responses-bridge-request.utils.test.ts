import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenAiCompatibleUpstream } from "./codex-openai-responses-bridge-request.utils.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("callOpenAiCompatibleUpstream", () => {
  it("preserves the complete raw provider error response", async () => {
    const responseText = JSON.stringify({
      error: {
        message: `provider detail ${"x".repeat(240)} END_OF_PROVIDER_ERROR`,
        metadata: { requestId: "request-1" },
      },
    });
    globalThis.fetch = vi.fn(async () => new Response(responseText, {
      status: 402,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof globalThis.fetch;

    await expect(callOpenAiCompatibleUpstream({
      config: { upstreamApiBase: "https://provider.example/v1" },
      body: { model: "provider/model" },
    })).rejects.toThrow(responseText);
  });
});
