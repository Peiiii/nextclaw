import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { callOpenAiCompatibleUpstream } from "./codex-openai-responses-bridge-request.js";
import {
  buildBridgeResponsePayload,
  writeResponsesStream,
  writeStreamError,
} from "./codex-openai-responses-bridge-stream.js";
import {
  readBoolean,
  readRecord,
  type BridgeEntry,
  type CodexOpenAiResponsesBridgeConfig,
  type CodexOpenAiResponsesBridgeResult,
} from "./codex-openai-responses-bridge-shared.js";

const bridgeCache = new Map<string, BridgeEntry>();

function toBridgeCacheKey(config: CodexOpenAiResponsesBridgeConfig): string {
  return JSON.stringify({
    upstreamApiBase: config.upstreamApiBase,
    upstreamApiKey: config.upstreamApiKey ?? "",
    upstreamExtraHeaders: config.upstreamExtraHeaders ?? {},
    defaultModel: config.defaultModel ?? "",
    modelPrefixes: (config.modelPrefixes ?? []).map((prefix) => prefix.trim().toLowerCase()),
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

async function handleResponsesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: CodexOpenAiResponsesBridgeConfig,
): Promise<void> {
  const body = await readJsonBody(request);
  if (!body) {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: {
          message: "Invalid JSON payload.",
        },
      }),
    );
    return;
  }

  try {
    const upstream = await callOpenAiCompatibleUpstream({
      config,
      body,
    });
    const responseId = randomUUID();
    const { outputItems, responseResource } = buildBridgeResponsePayload({
      responseId,
      model: upstream.model,
      response: upstream.response,
    });
    const wantsStream = readBoolean(body.stream) !== false;

    if (wantsStream) {
      writeResponsesStream({
        response,
        responseId,
        model: upstream.model,
        outputItems,
        responseResource,
      });
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(responseResource));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Codex OpenAI bridge request failed.";
    if (readBoolean(body.stream) !== false) {
      writeStreamError(response, message);
      return;
    }
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: {
          message,
        },
      }),
    );
  }
}

async function createCodexOpenAiResponsesBridge(
  config: CodexOpenAiResponsesBridgeConfig,
): Promise<CodexOpenAiResponsesBridgeResult> {
  const server = createServer((request, response) => {
    const pathname = request.url
      ? new URL(request.url, "http://127.0.0.1").pathname
      : "/";
    if (
      request.method === "POST" &&
      (pathname === "/responses" || pathname === "/v1/responses")
    ) {
      void handleResponsesRequest(request, response, config);
      return;
    }

    response.statusCode = 404;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: {
          message: `Unsupported Codex bridge path: ${pathname}`,
        },
      }),
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Codex bridge failed to bind a loopback port.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

export async function ensureCodexOpenAiResponsesBridge(
  config: CodexOpenAiResponsesBridgeConfig,
): Promise<CodexOpenAiResponsesBridgeResult> {
  const key = toBridgeCacheKey(config);
  const existing = bridgeCache.get(key);
  if (existing) {
    return await existing.promise;
  }

  const promise = createCodexOpenAiResponsesBridge(config);
  bridgeCache.set(key, { promise });
  try {
    return await promise;
  } catch (error) {
    bridgeCache.delete(key);
    throw error;
  }
}
