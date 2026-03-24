import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ClaudeCodeSdkAnthropicGatewayConfig } from "./claude-code-sdk-types.js";
import {
  type AnthropicMessagesRequest,
  type OpenAiChatCompletionsResponse,
  buildAnthropicError,
  buildAnthropicMessageResponse,
  readNumber,
  readRecord,
  readString,
  toOpenAiMessages,
  toOpenAiTools,
  withTrailingSlash,
} from "./anthropic-openai-bridge-payload.js";
import { writeAnthropicMessageStream } from "./anthropic-openai-bridge-stream.js";

type AnthropicBridgeResult = {
  baseUrl: string;
};

type BridgeEntry = {
  promise: Promise<AnthropicBridgeResult>;
};

const bridgeCache = new Map<string, BridgeEntry>();

function toBridgeCacheKey(config: ClaudeCodeSdkAnthropicGatewayConfig): string {
  return JSON.stringify({
    upstreamApiBase: config.upstreamApiBase,
    upstreamApiKey: config.upstreamApiKey ?? "",
  });
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawText = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawText) {
    return {};
  }

  try {
    return readRecord(JSON.parse(rawText)) ?? null;
  } catch {
    return null;
  }
}

async function callOpenAiCompatibleUpstream(params: {
  config: ClaudeCodeSdkAnthropicGatewayConfig;
  body: AnthropicMessagesRequest;
}): Promise<OpenAiChatCompletionsResponse> {
  const upstreamUrl = new URL("chat/completions", withTrailingSlash(params.config.upstreamApiBase));
  const tools = toOpenAiTools(params.body.tools);
  const response = await fetch(upstreamUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(readString(params.config.upstreamApiKey)
        ? {
            Authorization: `Bearer ${params.config.upstreamApiKey!.trim()}`,
          }
        : {}),
    },
    body: JSON.stringify({
      model: readString(params.body.model) ?? "default",
      messages: toOpenAiMessages(params.body),
      ...(tools ? { tools, tool_choice: "auto" } : {}),
      max_tokens: Math.max(16, Math.trunc(readNumber(params.body.max_tokens) ?? 1024)),
    }),
  });

  const rawText = await response.text();
  let parsed: OpenAiChatCompletionsResponse;
  try {
    parsed = JSON.parse(rawText) as OpenAiChatCompletionsResponse;
  } catch {
    throw new Error(`Gateway upstream returned invalid JSON: ${rawText.slice(0, 240)}`);
  }

  if (!response.ok) {
    const upstreamMessage =
      readString(parsed.error?.message) ??
      readString((readRecord(parsed.error) ?? {}).message) ??
      rawText.slice(0, 240) ??
      `HTTP ${response.status}`;
    throw new Error(upstreamMessage);
  }

  return parsed;
}

async function handleMessagesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: ClaudeCodeSdkAnthropicGatewayConfig,
): Promise<void> {
  const body = (await readJsonBody(request)) as AnthropicMessagesRequest | null;
  if (!body) {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(buildAnthropicError("Invalid JSON payload.")));
    return;
  }

  try {
    const anthropicMessage = buildAnthropicMessageResponse({
      requestModel: readString(body.model) ?? "default",
      openAiResponse: await callOpenAiCompatibleUpstream({
        config,
        body,
      }),
    });

    if (body.stream === true) {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream; charset=utf-8");
      response.setHeader("cache-control", "no-cache, no-transform");
      response.setHeader("connection", "keep-alive");
      writeAnthropicMessageStream(response, anthropicMessage);
      response.end();
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(anthropicMessage));
  } catch (error) {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify(buildAnthropicError(error instanceof Error ? error.message : "Gateway request failed.")),
    );
  }
}

async function createAnthropicBridge(
  config: ClaudeCodeSdkAnthropicGatewayConfig,
): Promise<AnthropicBridgeResult> {
  const server = createServer((request, response) => {
    const pathname = request.url ? new URL(request.url, "http://127.0.0.1").pathname : "/";
    if (request.method === "POST" && pathname === "/v1/messages") {
      void handleMessagesRequest(request, response, config);
      return;
    }

    response.statusCode = 404;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(buildAnthropicError(`Unsupported Claude gateway path: ${pathname}`)));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Claude gateway bridge failed to bind a loopback port.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

export async function ensureAnthropicOpenAiBridge(
  config: ClaudeCodeSdkAnthropicGatewayConfig,
): Promise<AnthropicBridgeResult> {
  const key = toBridgeCacheKey(config);
  const existing = bridgeCache.get(key);
  if (existing) {
    return await existing.promise;
  }

  const promise = createAnthropicBridge(config);
  bridgeCache.set(key, { promise });
  try {
    return await promise;
  } catch (error) {
    bridgeCache.delete(key);
    throw error;
  }
}
