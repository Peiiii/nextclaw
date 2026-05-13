import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ClaudeCodeSdkAnthropicGatewayConfig } from "@claude-code-sdk/claude-code-sdk-types.js";
import {
  type AnthropicMessagesRequest,
  type OpenAiChatCompletionsResponse,
  buildAnthropicError,
  buildAnthropicMessageResponse,
  readRecord,
  readString,
} from "./anthropic-openai-bridge-payload.utils.js";
import {
  writeAnthropicOpenAiUpstreamStream,
  writeAnthropicStreamError,
} from "./anthropic-openai-bridge-stream.utils.js";
import { buildOpenAiCompatibleUpstreamRequest } from "./anthropic-openai-upstream-request.utils.js";

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
  const { request } = buildOpenAiCompatibleUpstreamRequest({
    body: params.body,
    config: params.config,
    stream: false,
  });
  const response = await fetch(request.url, request.init);

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
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify(buildAnthropicError("Invalid JSON payload.")));
    return;
  }

  try {
    if (body.stream === true) {
      const { request } = buildOpenAiCompatibleUpstreamRequest({
        config,
        body,
        stream: true,
      });
      const upstreamResponse = await fetch(request.url, request.init);
      if (!upstreamResponse.ok) {
        throw new Error((await upstreamResponse.text()).slice(0, 240));
      }
      await writeAnthropicOpenAiUpstreamStream({
        response,
        requestModel: readString(body.model) ?? "default",
        upstreamResponse,
      });
      return;
    }

    const anthropicMessage = buildAnthropicMessageResponse({
      requestModel: readString(body.model) ?? "default",
      openAiResponse: await callOpenAiCompatibleUpstream({
        config,
        body,
      }),
    });

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(anthropicMessage));
  } catch (error) {
    if (body.stream === true) {
      writeAnthropicStreamError(
        response,
        error instanceof Error ? error.message : "Gateway request failed.",
      );
      return;
    }
    response.writeHead(400, { "content-type": "application/json" });
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
