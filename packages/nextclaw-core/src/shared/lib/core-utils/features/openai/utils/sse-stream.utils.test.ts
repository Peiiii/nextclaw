import { describe, expect, it, vi } from "vitest";
import { executeOpenAiStreamRequest } from "./sse-stream.utils.js";

describe("executeOpenAiStreamRequest", () => {
  it("preserves the complete provider error while retaining the bounded preview metadata", async () => {
    const responseText = JSON.stringify({
      error: {
        message: `provider detail ${"x".repeat(240)} END_OF_PROVIDER_ERROR`,
      },
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(responseText, {
      status: 402,
      headers: { "content-type": "application/json" },
    }));

    const request = executeOpenAiStreamRequest({
      fetchImpl,
      url: "https://provider.example/v1/chat/completions",
      body: { model: "provider/model" },
      errorLabel: "Chat Completions API",
    });

    await expect(request).rejects.toMatchObject({
      message: `Chat Completions API failed (402): ${responseText}`,
      status: 402,
      responseUrl: "https://provider.example/v1/chat/completions",
      bodyPreview: responseText.slice(0, 200),
      responseText,
    });
  });
});
