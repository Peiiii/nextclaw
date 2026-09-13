import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { OpenAICompatibleProvider } from "@core/features/llm-providers/providers/openai.provider.js";

describe("OpenAICompatibleProvider request headers", () => {
  it("merges request-scoped headers for non-stream and stream chat completions", async () => {
    const requests: Array<{ headers: Record<string, string | string[] | undefined>; stream: boolean }> = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { stream?: boolean };
        requests.push({ headers: request.headers, stream: body.stream === true });
        if (body.stream) {
          response.writeHead(200, { "Content-Type": "text/event-stream" });
          response.end([
            'data: {"id":"resp_stream","object":"chat.completion.chunk","created":0,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"OK"},"finish_reason":null}]}',
            'data: {"id":"resp_stream","object":"chat.completion.chunk","created":0,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
            'data: {"id":"resp_stream","object":"chat.completion.chunk","created":0,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}',
            "data: [DONE]",
            "",
          ].join("\n\n"));
          return;
        }
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          id: "resp_chat",
          object: "chat.completion",
          created: 0,
          model: "gpt-test",
          choices: [{ index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected an ephemeral port.");

    try {
      const provider = new OpenAICompatibleProvider({
        apiKey: "sk-test",
        apiBase: `http://127.0.0.1:${address.port}`,
        defaultModel: "gpt-test",
        extraHeaders: { "x-provider-static": "static", "x-opencode-session": "stale" },
        wireApi: "chat",
      });
      const requestHeaders = {
        "x-opencode-request": "message-1",
        "x-opencode-session": "session-1",
      };

      await provider.chat({ messages: [{ role: "user", content: "hello" }], requestHeaders });
      for await (const _event of provider.chatStream({
        messages: [{ role: "user", content: "hello" }],
        requestHeaders,
      })) {
        // Consume the stream.
      }
    } finally {
      server.close();
    }

    expect(requests.map(({ stream }) => stream)).toEqual([false, true]);
    for (const request of requests) {
      expect(request.headers["x-provider-static"]).toBe("static");
      expect(request.headers["x-opencode-session"]).toBe("session-1");
      expect(request.headers["x-opencode-request"]).toBe("message-1");
    }
  });
});
