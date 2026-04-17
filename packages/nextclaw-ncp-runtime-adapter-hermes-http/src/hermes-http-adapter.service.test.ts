import { afterEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpRequestEnvelope,
} from "@nextclaw/ncp";
import { NcpHttpAgentClientEndpoint } from "@nextclaw/ncp-http-agent-client";
import { HermesHttpAdapterServer } from "./hermes-http-adapter.service.js";

const closeHandlers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closeHandlers.length > 0) {
    const close = closeHandlers.pop();
    if (close) {
      await close();
    }
  }
});

describe("HermesHttpAdapterServer", () => {
  it("bridges Hermes chat completions into NCP events and preserves Hermes session continuity", async () => {
    const hermes = await startMockHermesServer();
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    const firstEvents = await sendAndCollect({
      endpoint,
      envelope: createEnvelope("session-hermes", "hello one"),
    });

    expect(firstEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.MessageAccepted,
        NcpEventType.RunStarted,
        NcpEventType.MessageTextDelta,
        NcpEventType.MessageCompleted,
        NcpEventType.RunFinished,
      ]),
    );
    expect(hermes.requests.chat).toHaveLength(1);
    expect(hermes.requests.chat[0]?.headers["x-hermes-session-id"]).toBeUndefined();

    const secondEvents = await sendAndCollect({
      endpoint,
      envelope: createEnvelope("session-hermes", "hello two"),
    });
    expect(secondEvents.some((event) => event.type === NcpEventType.MessageCompleted)).toBe(
      true,
    );
    expect(hermes.requests.chat).toHaveLength(2);
    expect(hermes.requests.chat[1]?.headers["x-hermes-session-id"]).toBe(
      "hermes-session-1",
    );
  });

  it("prefers the request model over the adapter default model", async () => {
    const hermes = await startMockHermesServer();
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    await sendAndCollect({
      endpoint,
      envelope: createEnvelope("session-hermes-model", "hello model", {
        preferred_model: "local-ollama/qwen3:1.7b",
      }),
    });

    expect(hermes.requests.chat).toHaveLength(2);
    expect(
      (hermes.requests.chat[0]?.body.messages as Array<{ content?: string }> | undefined)?.[0]?.content,
    ).toBe("/model qwen3:1.7b");
    expect(hermes.requests.chat[1]?.body.model).toBe("qwen3:1.7b");
  });

  it("forwards NextClaw provider routing and skips the legacy Hermes /model preflight", async () => {
    const hermes = await startMockHermesServer();
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    await sendAndCollect({
      endpoint,
      envelope: createEnvelope(
        "session-hermes-provider-route",
        "hello provider route",
        undefined,
        {
          model: "MiniMax-M2.7",
          apiKey: "minimax-key",
          apiBase: "https://api.minimax.chat/v1",
          headers: {
            "x-minimax-group-id": "group-123",
          },
        },
      ),
    });

    expect(hermes.requests.chat).toHaveLength(1);
    expect(hermes.requests.chat[0]?.body.model).toBe("MiniMax-M2.7");
    expect(hermes.requests.chat[0]?.body.nextclaw_provider_route).toEqual({
      model: "MiniMax-M2.7",
      provider: "openai",
      api_key: "minimax-key",
      base_url: "https://api.minimax.chat/v1",
      extra_headers: {
        "x-minimax-group-id": "group-123",
      },
    });
  });

  it("forwards NCP tool definitions to the Hermes chat completion request", async () => {
    const hermes = await startMockHermesServer();
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    await sendAndCollect({
      endpoint,
      envelope: {
        ...createEnvelope("session-hermes-tools", "hello tools"),
        tools: [
          {
            type: "function",
            function: {
              name: "list_dir",
              description: "List files",
              parameters: {
                type: "object",
                properties: {},
                additionalProperties: false,
              },
            },
          },
        ],
      },
    });

    expect(
      ((hermes.requests.chat[0]?.body.tools as Array<{ function?: { name?: string } }> | undefined) ?? [])
        .map((tool) => tool.function?.name),
    ).toContain("list_dir");
  });

  it("aborts the active Hermes upstream stream when /abort is called", async () => {
    const hermes = await startMockHermesServer({
      mode: "hanging",
    });
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    const events: NcpEndpointEvent[] = [];
    const unsubscribe = endpoint.subscribe((event) => {
      events.push(event);
    });
    const streamPromise = endpoint.stream({ sessionId: "session-abort" });
    await waitForNextTick();
    await endpoint.send(createEnvelope("session-abort", "please hang"));

    await waitFor(
      () =>
        events.some((event) => event.type === NcpEventType.MessageTextDelta),
      2000,
    );

    await endpoint.abort({ sessionId: "session-abort" });
    await streamPromise;
    unsubscribe();

    await waitFor(() => hermes.abortSignals.closedCount > 0, 2000);
    expect(hermes.abortSignals.closedCount).toBeGreaterThan(0);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.MessageFailed,
        NcpEventType.RunError,
      ]),
    );
  });

  it("surfaces an empty Hermes completion as a runtime error instead of a fake success", async () => {
    const hermes = await startMockHermesServer({
      mode: "empty",
    });
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    const events = await sendAndCollect({
      endpoint,
      envelope: createEnvelope("session-hermes-empty", "hello empty"),
    });

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.MessageAccepted,
        NcpEventType.RunStarted,
        NcpEventType.MessageFailed,
        NcpEventType.RunError,
      ]),
    );
    expect(events.some((event) => event.type === NcpEventType.MessageCompleted)).toBe(false);
    expect(events.some((event) => event.type === NcpEventType.RunFinished)).toBe(false);
  });

  it("normalizes think-tag content into reasoning events and final message parts", async () => {
    const hermes = await startMockHermesServer({
      mode: "think-tags",
    });
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    const events = await sendAndCollect({
      endpoint,
      envelope: createEnvelope("session-hermes-think-tags", "hello think"),
    });

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.MessageReasoningDelta,
        NcpEventType.MessageTextDelta,
        NcpEventType.MessageCompleted,
        NcpEventType.RunFinished,
      ]),
    );

    const completed = events.find(
      (event) => event.type === NcpEventType.MessageCompleted,
    );
    expect(completed?.type).toBe(NcpEventType.MessageCompleted);
    if (completed?.type === NcpEventType.MessageCompleted) {
      expect(completed.payload.message.parts).toEqual([
        { type: "reasoning", text: "internal reasoning" },
        { type: "text", text: "visible answer" },
      ]);
    }
  });

  it("preserves tool-call events and final tool-invocation parts", async () => {
    const hermes = await startMockHermesServer({
      mode: "tool-call",
    });
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    const events = await sendAndCollect({
      endpoint,
      envelope: createEnvelope("session-hermes-tool-call", "hello tool"),
    });

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.MessageToolCallStart,
        NcpEventType.MessageToolCallArgsDelta,
        NcpEventType.MessageToolCallEnd,
        NcpEventType.MessageCompleted,
        NcpEventType.RunFinished,
      ]),
    );

    const completed = events.find(
      (event) => event.type === NcpEventType.MessageCompleted,
    );
    expect(completed?.type).toBe(NcpEventType.MessageCompleted);
    if (completed?.type === NcpEventType.MessageCompleted) {
      expect(completed.payload.message.parts).toEqual([
        {
          type: "tool-invocation",
          toolCallId: "tool-call-1",
          toolName: "search_web",
          state: "call",
          args: "{\"q\":\"weather\"}",
        },
      ]);
    }
  });

  it("translates Hermes inline tool traces into standard tool-call events and parts", async () => {
    const hermes = await startMockHermesServer({
      mode: "inline-tool-trace",
    });
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    const events = await sendAndCollect({
      endpoint,
      envelope: createEnvelope("session-hermes-inline-tool", "hello inline tool"),
    });

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.MessageToolCallStart,
        NcpEventType.MessageToolCallArgs,
        NcpEventType.MessageToolCallEnd,
        NcpEventType.MessageCompleted,
        NcpEventType.RunFinished,
      ]),
    );

    const completed = events.find(
      (event) => event.type === NcpEventType.MessageCompleted,
    );
    expect(completed?.type).toBe(NcpEventType.MessageCompleted);
    if (completed?.type === NcpEventType.MessageCompleted) {
      expect(completed.payload.message.parts).toEqual(
        expect.arrayContaining([
          { type: "reasoning", text: "plan first" },
          {
            type: "tool-invocation",
            toolCallId: "hermes-inline-tool-1",
            toolName: "search_files",
            state: "call",
            args: "{\"pattern\":\"*.py\"}",
          },
        ]),
      );
      expect(
        completed.payload.message.parts.some(
          (part) => part.type === "text" && part.text.includes("Here are the files."),
        ),
      ).toBe(true);
    }
  });

  it("keeps post-tool think tags out of final text while preserving tool-invocation parts", async () => {
    const hermes = await startMockHermesServer({
      mode: "inline-tool-trace-with-post-tool-think",
    });
    const adapter = await startAdapterServer(hermes.baseUrl);
    const endpoint = new NcpHttpAgentClientEndpoint({
      baseUrl: adapter.baseUrl,
      basePath: "/ncp/agent",
    });

    const events = await sendAndCollect({
      endpoint,
      envelope: createEnvelope("session-hermes-inline-tool-post-think", "hello inline tool with post think"),
    });

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.MessageReasoningDelta,
        NcpEventType.MessageToolCallStart,
        NcpEventType.MessageToolCallArgs,
        NcpEventType.MessageToolCallEnd,
        NcpEventType.MessageCompleted,
        NcpEventType.RunFinished,
      ]),
    );

    const completed = events.find(
      (event) => event.type === NcpEventType.MessageCompleted,
    );
    expect(completed?.type).toBe(NcpEventType.MessageCompleted);
    if (completed?.type === NcpEventType.MessageCompleted) {
      expect(completed.payload.message.parts).toEqual(
        expect.arrayContaining([
        {
          type: "tool-invocation",
          toolCallId: "hermes-inline-tool-1",
          toolName: "search_files",
          state: "call",
          args: "{\"pattern\":\"*.py\"}",
        },
        {
          type: "reasoning",
          text: "use the tool result",
        },
        ]),
      );
      const lastPart = completed.payload.message.parts.at(-1);
      expect(lastPart?.type).toBe("text");
      if (lastPart?.type === "text") {
        expect(lastPart.text).not.toContain("<think>");
        expect(lastPart.text).toContain("Here are the first 3 Python files.");
      }
    }
  });
});

async function sendAndCollect(params: {
  endpoint: NcpHttpAgentClientEndpoint;
  envelope: NcpRequestEnvelope;
}): Promise<NcpEndpointEvent[]> {
  const { endpoint, envelope } = params;
  const events: NcpEndpointEvent[] = [];
  const unsubscribe = endpoint.subscribe((event) => {
    events.push(event);
  });

  const streamPromise = endpoint.stream({
    sessionId: envelope.sessionId,
  });
  await waitForNextTick();
  await endpoint.send(envelope);
  await streamPromise;
  unsubscribe();

  return events.filter((event) => event.type !== NcpEventType.EndpointReady);
}

function createEnvelope(
  sessionId: string,
  text: string,
  metadata?: Record<string, unknown>,
  providerRoute?: NcpRequestEnvelope["providerRoute"],
): NcpRequestEnvelope {
  return {
    sessionId,
    message: {
      id: `${sessionId}-user`,
      sessionId,
      role: "user",
      status: "final",
      parts: [{ type: "text", text }],
      timestamp: new Date().toISOString(),
    },
    ...(metadata ? { metadata } : {}),
    ...(providerRoute ? { providerRoute } : {}),
  };
}

async function startAdapterServer(hermesBaseUrl: string): Promise<{
  baseUrl: string;
}> {
  const port = await getFreePort();
  const adapter = new HermesHttpAdapterServer({
    host: "127.0.0.1",
    port,
    hermesBaseUrl,
    hermesApiKey: "test-key",
  });
  await adapter.start();
  closeHandlers.push(async () => {
    await adapter.stop();
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

async function startMockHermesServer(options: {
  mode?:
    | "normal"
    | "hanging"
    | "empty"
    | "think-tags"
    | "tool-call"
    | "inline-tool-trace"
    | "inline-tool-trace-with-post-tool-think";
} = {}): Promise<{
  baseUrl: string;
  requests: {
    chat: Array<{
      headers: Record<string, string | undefined>;
      body: Record<string, unknown>;
    }>;
  };
  abortSignals: {
    closedCount: number;
  };
}> {
  const requests = {
    chat: [] as Array<{
      headers: Record<string, string | undefined>;
      body: Record<string, unknown>;
    }>,
  };
  const abortSignals = {
    closedCount: 0,
  };
  let sessionCounter = 0;
  const sessionModels = new Map<string, string>();

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const sessionHeader = request.headers["x-hermes-session-id"];
      requests.chat.push({
        headers: {
          authorization: request.headers.authorization,
          "x-hermes-session-id":
            typeof sessionHeader === "string" ? sessionHeader : undefined,
        },
        body,
      });

      sessionCounter += 1;
      const nextSessionId =
        (typeof sessionHeader === "string" && sessionHeader.trim()) || `hermes-session-${sessionCounter}`;
      const firstMessage = Array.isArray(body.messages)
        ? (body.messages[0] as { content?: unknown } | undefined)
        : undefined;
      const firstContent =
        firstMessage && typeof firstMessage.content === "string"
          ? firstMessage.content.trim()
          : "";
      if (!body.stream && firstContent.startsWith("/model ")) {
        const requestedModel = firstContent.slice("/model ".length).trim();
        sessionModels.set(nextSessionId, requestedModel);
        response.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "x-hermes-session-id": nextSessionId,
        });
        response.end(
          JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            object: "chat.completion",
            created: Date.now(),
            model: requestedModel,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: `Model switched to \`${requestedModel}\``,
                },
                finish_reason: "stop",
              },
            ],
          }),
        );
        return;
      }

      const activeModel =
        sessionModels.get(nextSessionId) ||
        (typeof body.model === "string" ? body.model : "unknown-model");
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "x-hermes-session-id": nextSessionId,
      });
      response.write(
        `data: ${JSON.stringify({
          id: `chatcmpl-${sessionCounter}`,
          choices: [{ delta: { role: "assistant" }, finish_reason: null }],
        })}\n\n`,
      );

      if (options.mode === "empty") {
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [{ delta: {}, finish_reason: "stop" }],
          })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
      }

      if (options.mode === "think-tags") {
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [
              {
                delta: { content: "<think>internal reasoning</think>\n\nvisible answer" },
                finish_reason: null,
              },
            ],
          })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [{ delta: {}, finish_reason: "stop" }],
          })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
      }

      if (options.mode === "tool-call") {
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "tool-call-1",
                      function: {
                        name: "search_web",
                        arguments: "{\"q\":",
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      function: {
                        arguments: "\"weather\"}",
                      },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
      }

      if (options.mode === "inline-tool-trace") {
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [
              {
                delta: { content: "<think>plan first</think>\n\n" },
                finish_reason: null,
              },
            ],
          })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [
              {
                delta: { content: "\n`🔎 *.py`\n" },
                finish_reason: null,
              },
            ],
          })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [
              {
                delta: { content: "\nHere are the files." },
                finish_reason: "stop",
              },
            ],
          })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
      }

      if (options.mode === "inline-tool-trace-with-post-tool-think") {
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [
              {
                delta: { content: "\n`🔎 *.py`\n" },
                finish_reason: null,
              },
            ],
          })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${sessionCounter}`,
            choices: [
              {
                delta: { content: "<think>use the tool result</think>\n\nHere are the first 3 Python files." },
                finish_reason: "stop",
              },
            ],
          })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
      }

      response.write(
        `data: ${JSON.stringify({
          id: `chatcmpl-${sessionCounter}`,
          choices: [
            {
              delta: { content: `hello from hermes ${sessionCounter} model=${activeModel}` },
              finish_reason: null,
            },
          ],
        })}\n\n`,
      );

      if (options.mode === "hanging") {
        const markClosed = (): void => {
          abortSignals.closedCount += 1;
          response.end();
        };
        request.on("aborted", markClosed);
        request.on("close", markClosed);
        response.on("close", markClosed);
        return;
      }

      response.write(
        `data: ${JSON.stringify({
          id: `chatcmpl-${sessionCounter}`,
          choices: [{ delta: {}, finish_reason: "stop" }],
        })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  closeHandlers.push(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    abortSignals,
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("timed out waiting for condition");
    }
    await waitForNextTick();
  }
}

async function waitForNextTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

async function getFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  return port;
}
