import { createServer, type IncomingMessage, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexOpenAiResponsesBridge } from "../../../../../extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-openai-responses-bridge.js";

type RecordedRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
};

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    ),
  );
  servers.length = 0;
});

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function startUpstreamServer(params: {
  responder: (request: RecordedRequest) => Record<string, unknown>;
}): Promise<{
  baseUrl: string;
  requests: RecordedRequest[];
}> {
  const requests: RecordedRequest[] = [];
  const server = createServer((request, response) => {
    void (async () => {
      const body = await readJsonBody(request);
      const recordedRequest: RecordedRequest = {
        method: request.method ?? "GET",
        url: request.url ?? "/",
        headers: { ...request.headers },
        body,
      };
      requests.push(recordedRequest);
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(params.responder(recordedRequest)));
    })().catch((error) => {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    });
  });

  servers.push(server);
  const baseUrl = await new Promise<string>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to resolve upstream server address"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}/compatible-mode/v1`);
    });
    server.once("error", reject);
  });

  return {
    baseUrl,
    requests,
  };
}

function extractSseEvents(rawText: string): Array<Record<string, unknown>> {
  return rawText
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) {
        throw new Error(`Missing data line in SSE chunk: ${chunk}`);
      }
      return JSON.parse(dataLine.slice("data: ".length)) as Record<string, unknown>;
    });
}

async function createBridge(params: {
  baseUrl: string;
  extraHeaders?: Record<string, string>;
}) {
  return await ensureCodexOpenAiResponsesBridge({
    upstreamApiBase: params.baseUrl,
    upstreamApiKey: "test-upstream-key",
    ...(params.extraHeaders ? { upstreamExtraHeaders: params.extraHeaders } : {}),
    defaultModel: "qwen3-coder-next",
    modelPrefixes: ["dashscope"],
  });
}

async function postBridgeRequest(params: {
  bridgeBaseUrl: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch(`${params.bridgeBaseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.body),
  });
  return {
    status: response.status,
    events: extractSseEvents(await response.text()),
  };
}

function expectAssistantUpstreamRequest(request: RecordedRequest | undefined): void {
  expect(request?.url).toBe("/compatible-mode/v1/chat/completions");
  expect(request?.headers.authorization).toBe("Bearer test-upstream-key");
  expect(request?.headers["x-test-header"]).toBe("bridge-ok");
  expect(request?.body).toEqual({
    model: "qwen3-coder-next",
    messages: [
      {
        role: "system",
        content: "be precise",
      },
      {
        role: "assistant",
        content: "earlier reply",
      },
      {
        role: "user",
        content: "current question",
      },
    ],
  });
}

function expectAssistantEvents(events: Array<Record<string, unknown>>): void {
  expect(events.map((event) => event.type)).toEqual([
    "response.created",
    "response.output_item.added",
    "response.content_part.added",
    "response.output_text.delta",
    "response.output_text.done",
    "response.content_part.done",
    "response.output_item.done",
    "response.completed",
  ]);
  expect(events[1]?.item).toEqual({
    type: "message",
    id: expect.any(String),
    role: "assistant",
    status: "in_progress",
    content: [],
  });
  expect(events[5]?.part).toEqual({
    type: "output_text",
    text: "bridge reply",
    annotations: [],
  });
  expect(events[6]?.item).toEqual({
    type: "message",
    id: expect.any(String),
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: "bridge reply", annotations: [] }],
  });
}

function expectToolCallUpstreamRequest(request: RecordedRequest | undefined): void {
  expect(request?.body).toEqual({
    model: "qwen3-coder-next",
    messages: [
      {
        role: "assistant",
        content: "I will inspect it.",
        tool_calls: [
          {
            id: "call_shell_0",
            type: "function",
            function: {
              name: "shell",
              arguments: "{\"command\":\"ls\"}",
            },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_shell_0",
        content: "file-a\nfile-b",
      },
      {
        role: "user",
        content: "continue",
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "shell",
          description: "run shell",
          parameters: {
            type: "object",
            properties: {
              command: { type: "string" },
            },
          },
          strict: false,
        },
      },
    ],
    tool_choice: "auto",
  });
}

function expectToolCallEvents(events: Array<Record<string, unknown>>): void {
  expect(events.map((event) => event.type)).toEqual([
    "response.created",
    "response.output_item.added",
    "response.function_call_arguments.delta",
    "response.function_call_arguments.done",
    "response.output_item.done",
    "response.completed",
  ]);
  expect(events[1]?.item).toEqual({
    type: "function_call",
    id: expect.any(String),
    call_id: "call_shell_1",
    name: "shell",
    arguments: "",
    status: "in_progress",
  });
  expect(events[4]?.item).toEqual({
    type: "function_call",
    id: expect.any(String),
    call_id: "call_shell_1",
    name: "shell",
    arguments: "{\"command\":\"pwd\"}",
    status: "completed",
  });
}

describe("ensureCodexOpenAiResponsesBridge", () => {
  it("maps OpenResponses requests into chat/completions and streams assistant output back", async () => {
    const upstream = await startUpstreamServer({
      responder: () => ({
        id: "chatcmpl-1",
        choices: [
          {
            message: {
              role: "assistant",
              content: "bridge reply",
            },
          },
        ],
        usage: {
          prompt_tokens: 11,
          completion_tokens: 7,
          total_tokens: 18,
        },
      }),
    });
    const bridge = await createBridge({
      baseUrl: upstream.baseUrl,
      extraHeaders: {
        "x-test-header": "bridge-ok",
      },
    });
    const result = await postBridgeRequest({
      bridgeBaseUrl: bridge.baseUrl,
      body: {
        model: "dashscope/qwen3-coder-next",
        input: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "earlier reply" }],
          },
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "current question" }],
          },
        ],
        instructions: "be precise",
        stream: true,
      },
    });

    expect(result.status).toBe(200);
    expect(upstream.requests).toHaveLength(1);
    expectAssistantUpstreamRequest(upstream.requests[0]);
    expectAssistantEvents(result.events);
  });

  it("maps tool calls and tool outputs between responses and chat/completions", async () => {
    const upstream = await startUpstreamServer({
      responder: () => ({
        id: "chatcmpl-2",
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                {
                  id: "call_shell_1",
                  type: "function",
                  function: {
                    name: "shell",
                    arguments: "{\"command\":\"pwd\"}",
                  },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 4,
          completion_tokens: 2,
          total_tokens: 6,
        },
      }),
    });
    const bridge = await createBridge({
      baseUrl: upstream.baseUrl,
    });
    const result = await postBridgeRequest({
      bridgeBaseUrl: bridge.baseUrl,
      body: {
        model: "dashscope/qwen3-coder-next",
        input: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "I will inspect it." }],
          },
          {
            type: "function_call",
            call_id: "call_shell_0",
            name: "shell",
            arguments: "{\"command\":\"ls\"}",
          },
          {
            type: "function_call_output",
            call_id: "call_shell_0",
            output: "file-a\nfile-b",
          },
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "continue" }],
          },
        ],
        tools: [
          {
            type: "function",
            name: "shell",
            description: "run shell",
            strict: false,
            parameters: {
              type: "object",
              properties: {
                command: { type: "string" },
              },
            },
          },
        ],
        tool_choice: "auto",
        stream: true,
      },
    });

    expect(result.status).toBe(200);
    expect(upstream.requests).toHaveLength(1);
    expectToolCallUpstreamRequest(upstream.requests[0]);
    expectToolCallEvents(result.events);
  });
});
