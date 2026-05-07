import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { LLMStreamEvent } from "./base.js";
import { OpenAICompatibleProvider } from "./openai_provider.js";
import { parseOpenAiResponsesPayload } from "../utils/openai/responses-payload.utils.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("OpenAICompatibleProvider responses payload parser", () => {
  it("unwraps response.completed envelope from SSE payload", () => {
    const raw = [
      "event: response.created",
      'data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress"}}',
      "event: response.completed",
      'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"OK"}]}]}}',
      "data: [DONE]"
    ].join("\n");

    const parsed = parseOpenAiResponsesPayload(raw);
    const output = parsed.output as Array<Record<string, unknown>> | undefined;
    expect(Array.isArray(output)).toBe(true);
    expect((parsed as { status?: string }).status).toBe("completed");
  });

  it("prefers SSE frame with response payload over trailing event metadata", () => {
    const raw = [
      'data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"done"}]}]}}',
      'data: {"type":"response.done"}'
    ].join("\n");

    const parsed = parseOpenAiResponsesPayload(raw);
    expect(parsed).not.toBeNull();
    expect(Array.isArray((parsed as { output?: unknown }).output)).toBe(true);
  });

  it("injects reasoning effort when thinkingLevel is provided for responses API", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
          usage: {}
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof globalThis.fetch;

    const responseProvider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "gpt-test",
      wireApi: "responses"
    });
    await responseProvider.chat({
      messages: [{ role: "user", content: "hello" }],
      thinkingLevel: "medium"
    });

    expect(capturedBody).not.toBeNull();
    const reasoning = capturedBody && typeof capturedBody === "object"
      ? (capturedBody as Record<string, unknown>).reasoning
      : undefined;
    expect(reasoning).toEqual({ effort: "medium" });
  });

  it("does not inject reasoning effort when thinkingLevel is off", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
          usage: {}
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof globalThis.fetch;

    const responseProvider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "gpt-test",
      wireApi: "responses"
    });
    await responseProvider.chat({
      messages: [{ role: "user", content: "hello" }],
      thinkingLevel: "off"
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody).not.toHaveProperty("reasoning");
  });

  it("preserves nested cache usage details from responses API", async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
        usage: {
          input_tokens: 1500,
          output_tokens: 80,
          total_tokens: 1580,
          input_tokens_details: {
            cached_tokens: 1024
          }
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )) as unknown as typeof globalThis.fetch;

    const responseProvider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "gpt-test",
      wireApi: "responses"
    });
    const response = await responseProvider.chat({
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.usage).toMatchObject({
      input_tokens: 1500,
      output_tokens: 80,
      total_tokens: 1580,
      prompt_tokens: 1500,
      completion_tokens: 80,
      input_tokens_details_cached_tokens: 1024
    });
  });

  it("sends stream=true on the first responses request and aggregates SSE for chat", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { stream?: boolean };
      expect(body.stream).toBe(true);
      return new Response(
        [
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"stream "}',
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"ok"}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"stream ok"}]}],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}',
          "data: [DONE]",
          ""
        ].join("\n\n"),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const responseProvider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "gpt-test",
      wireApi: "responses"
    });
    const response = await responseProvider.chat({
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.content).toBe("stream ok");
    expect(response.usage).toMatchObject({
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("streams delta events from responses API before the final done event", async () => {
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { stream?: boolean };
      expect(body.stream).toBe(true);
      return new Response(
        [
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"hello "}',
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"world"}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"hello world"}]}],"usage":{"input_tokens":2,"output_tokens":2,"total_tokens":4}}}',
          "data: [DONE]",
          ""
        ].join("\n\n"),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      );
    }) as unknown as typeof globalThis.fetch;

    const responseProvider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "gpt-test",
      wireApi: "responses"
    });

    const events: LLMStreamEvent[] = [];
    for await (const event of responseProvider.chatStream({
      messages: [{ role: "user", content: "hello" }]
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "delta", delta: "hello " },
      { type: "delta", delta: "world" },
      {
        type: "done",
        response: {
          content: "hello world",
          toolCalls: [],
          finishReason: "completed",
          usage: {
            input_tokens: 2,
            output_tokens: 2,
            prompt_tokens: 2,
            completion_tokens: 2,
            total_tokens: 4
          },
          reasoningContent: null
        }
      }
    ]);
  });

  it("ignores transport noise after response.completed from responses API", async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      [
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"pong"}',
        'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"pong"}]}],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}',
        'event: error\ndata: {"error":"upstream_disconnect","message":"Upstream connection closed unexpectedly"}',
        "data: [DONE]",
        ""
      ].join("\n\n"),
      { status: 200, headers: { "Content-Type": "text/event-stream" } }
    )) as unknown as typeof globalThis.fetch;

    const responseProvider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "gpt-test",
      wireApi: "responses"
    });

    const response = await responseProvider.chat({
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response).toEqual({
      content: "pong",
      toolCalls: [],
      finishReason: "completed",
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2
      },
      reasoningContent: null
    });
  });

  it("falls back to accumulated stream content when response.completed payload is empty", async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      [
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"pong"}',
        'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}',
        "data: [DONE]",
        ""
      ].join("\n\n"),
      { status: 200, headers: { "Content-Type": "text/event-stream" } }
    )) as unknown as typeof globalThis.fetch;

    const responseProvider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "gpt-test",
      wireApi: "responses"
    });

    const response = await responseProvider.chat({
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response).toEqual({
      content: "pong",
      toolCalls: [],
      finishReason: "completed",
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2
      },
      reasoningContent: null
    });
  });

  it("parses SSE payloads even when the upstream content-type is text/plain", async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      [
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"pong"}',
        'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}',
        "data: [DONE]",
        ""
      ].join("\n\n"),
      { status: 200, headers: { "Content-Type": "text/plain; charset=UTF-8" } }
    )) as unknown as typeof globalThis.fetch;

    const responseProvider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "gpt-test",
      wireApi: "responses"
    });

    const response = await responseProvider.chat({
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response).toEqual({
      content: "pong",
      toolCalls: [],
      finishReason: "completed",
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2
      },
      reasoningContent: null
    });
  });
});

describe("OpenAICompatibleProvider responses fallback policy", () => {
  it("does not fall back to responses when responses fallback is disabled", async () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "qwen3-coder-next",
      enableResponsesFallback: false
    }) as unknown as {
      chat: (params: { messages: Array<Record<string, unknown>> }) => Promise<unknown>;
      getClient: () => {
        chat: {
          completions: {
            create: ReturnType<typeof vi.fn>;
          };
        };
      };
    };

    const notFoundError = new Error("Cannot POST /chat/completions") as Error & { status?: number };
    notFoundError.status = 404;
    provider.getClient = () => ({
      chat: {
        completions: {
          create: vi.fn(async () => {
            throw notFoundError;
          }),
        },
      },
    });
    globalThis.fetch = vi.fn(async () => {
      throw new Error("responses should not be called");
    }) as unknown as typeof globalThis.fetch;

    await expect(
      provider.chat({
        messages: [{ role: "user", content: "hello" }]
      })
    ).rejects.toThrow("Cannot POST /chat/completions");

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("OpenAICompatibleProvider /v1 fallback", () => {
  it("retries chat completions stream against /v1 when the root base returns an empty stream", async () => {
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.url ?? "");
      if (request.url === "/chat/completions") {
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.end("data: [DONE]\n\n");
        return;
      }
      if (request.url === "/v1/chat/completions") {
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.end([
          'data: {"id":"resp_1","object":"chat.completion.chunk","created":0,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"OK"},"finish_reason":null}]}',
          'data: {"id":"resp_1","object":"chat.completion.chunk","created":0,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
          'data: {"id":"resp_1","object":"chat.completion.chunk","created":0,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}',
          "data: [DONE]",
          "",
        ].join("\n\n"));
        return;
      }
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: `Unhandled path ${request.url}` } }));
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected http server to bind an ephemeral port.");
    }

    const provider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: `http://127.0.0.1:${address.port}`,
      defaultModel: "gpt-test",
      wireApi: "chat",
    });

    const events: LLMStreamEvent[] = [];
    for await (const event of provider.chatStream({
      messages: [{ role: "user", content: "hello" }],
    })) {
      events.push(event);
    }

    server.close();

    expect(requests).toEqual(["/chat/completions", "/v1/chat/completions"]);
    expect(events).toEqual([
      { type: "delta", delta: "OK" },
      {
        type: "done",
        response: {
          content: "OK",
          toolCalls: [],
          finishReason: "stop",
          usage: {
            prompt_tokens: 1,
            completion_tokens: 1,
            total_tokens: 2,
          },
          reasoningContent: null,
        },
      },
    ]);
  });

  it("retries non-stream chat completions against /v1 when the root base returns an empty assistant", async () => {
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.url ?? "");
      response.writeHead(200, { "Content-Type": "application/json" });
      if (request.url === "/chat/completions") {
        response.end(JSON.stringify({
          id: "resp_root",
          object: "chat.completion",
          created: 0,
          model: "gpt-test",
          choices: [
            {
              index: 0,
              message: { role: "assistant" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 1,
            completion_tokens: 1,
            total_tokens: 2,
          },
        }));
        return;
      }
      if (request.url === "/v1/chat/completions") {
        response.end(JSON.stringify({
          id: "resp_v1",
          object: "chat.completion",
          created: 0,
          model: "gpt-test",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "OK" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 1,
            completion_tokens: 1,
            total_tokens: 2,
          },
        }));
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: { message: `Unhandled path ${request.url}` } }));
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected http server to bind an ephemeral port.");
    }

    const provider = new OpenAICompatibleProvider({
      apiKey: "sk-test",
      apiBase: `http://127.0.0.1:${address.port}`,
      defaultModel: "gpt-test",
      wireApi: "chat",
    });

    const response = await provider.chat({
      messages: [{ role: "user", content: "hello" }],
    });

    server.close();

    expect(requests).toEqual(["/chat/completions", "/v1/chat/completions"]);
    expect(response).toEqual({
      content: "OK",
      toolCalls: [],
      finishReason: "stop",
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
      reasoningContent: null,
    });
  });
});
