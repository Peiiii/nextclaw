import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCodexResponsesApiSupport } from "../../../../../extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-responses-capability.js";

type MockResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function mockFetchResponse(response: MockResponse): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response as never),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolveCodexResponsesApiSupport", () => {
  it("treats a truncated responses stream as unsupported", async () => {
    mockFetchResponse({
      ok: true,
      status: 200,
      text: async () =>
        [
          "event: response.created",
          'data: {"type":"response.created"}',
          "",
        ].join("\n"),
    });

    await expect(
      resolveCodexResponsesApiSupport({
        apiBase: "https://example.com/v1",
        apiKey: "test-key-truncated",
        model: "gpt-5.4",
      }),
    ).resolves.toBe(false);
  });

  it("accepts a stream that reaches response.completed", async () => {
    mockFetchResponse({
      ok: true,
      status: 200,
      text: async () =>
        [
          "event: response.created",
          'data: {"type":"response.created"}',
          "",
          "event: response.completed",
          'data: {"type":"response.completed","response":{"status":"completed"}}',
          "",
        ].join("\n"),
    });

    await expect(
      resolveCodexResponsesApiSupport({
        apiBase: "https://example.com/v1",
        apiKey: "test-key-completed",
        model: "gpt-5.4",
      }),
    ).resolves.toBe(true);
  });
});
