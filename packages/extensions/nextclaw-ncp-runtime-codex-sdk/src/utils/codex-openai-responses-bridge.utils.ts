import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  buildOpenAiCompatibleUpstreamRequest,
  callOpenAiCompatibleUpstream,
} from "./codex-openai-responses-bridge-request.utils.js";
import {
  buildBridgeResponsePayload,
  writeStreamError,
} from "./codex-openai-responses-bridge-stream.utils.js";
import { writeResponsesUpstreamStream } from "./codex-openai-responses-stream-writer.utils.js";
import {
  readBoolean,
  readRecord,
  type BridgeEntry,
  type CodexOpenAiResponsesBridgeConfig,
  type CodexOpenAiResponsesBridgeResult,
} from "@/codex-openai-responses-bridge-shared.utils.js";
import type { CodexOpenAiResponsesOutputObserver } from "./codex-openai-responses-stream-writer.utils.js";

const bridgeCache = new Map<string, BridgeEntry>();

export type CodexOpenAiResponsesBridgeRuntimeConfig = CodexOpenAiResponsesBridgeConfig & {
  outputObserver?: CodexOpenAiResponsesOutputObserver;
};

function toBridgeCacheKey(config: CodexOpenAiResponsesBridgeConfig): string {
  return JSON.stringify({
    upstreamApiBase: config.upstreamApiBase,
    upstreamApiKey: config.upstreamApiKey ?? "",
    upstreamExtraHeaders: config.upstreamExtraHeaders ?? {},
    defaultModel: config.defaultModel ?? "",
    modelPrefixes: (config.modelPrefixes ?? []).map((prefix) => prefix.trim().toLowerCase()),
    upstreamReasoningSplit: config.upstreamReasoningSplit === true,
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
  config: CodexOpenAiResponsesBridgeRuntimeConfig,
): Promise<void> {
  await new CodexResponsesBridgeRequestHandler(request, response, config).handle();
}

class JsonResponseWriter {
  constructor(private readonly response: ServerResponse) {}

  write = (statusCode: number, body: Record<string, unknown>): void => {
    this.response.statusCode = statusCode;
    this.response.setHeader("content-type", "application/json");
    this.response.end(JSON.stringify(body));
  };
}

class CodexResponsesBridgeRequestHandler {
  private readonly jsonWriter: JsonResponseWriter;

  constructor(
    private readonly request: IncomingMessage,
    private readonly response: ServerResponse,
    private readonly config: CodexOpenAiResponsesBridgeRuntimeConfig,
  ) {
    this.jsonWriter = new JsonResponseWriter(response);
  }

  handle = async (): Promise<void> => {
    const body = await readJsonBody(this.request);
    if (!body) {
      this.writeErrorJson(400, "Invalid JSON payload.");
      return;
    }

    try {
      if (readBoolean(body.stream) !== false) {
        await this.writeStreamingResponse(body);
        return;
      }
      await this.writeJsonResponse(body);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Codex OpenAI bridge request failed.";
      if (readBoolean(body.stream) !== false) {
        writeStreamError(this.response, message);
        return;
      }
      this.writeErrorJson(400, message);
    }
  };

  private writeStreamingResponse = async (body: Record<string, unknown>): Promise<void> => {
    const responseId = randomUUID();
    const upstream = buildOpenAiCompatibleUpstreamRequest({
      config: this.config,
      body,
      stream: true,
    });
    const upstreamResponse = await fetch(upstream.request.url, upstream.request.init);
    if (!upstreamResponse.ok) {
      throw new Error((await upstreamResponse.text()).slice(0, 240));
    }
    await writeResponsesUpstreamStream({
      response: this.response,
      responseId,
      model: upstream.model,
      outputObserver: this.config.outputObserver,
      upstreamResponse,
    });
  };

  private writeJsonResponse = async (body: Record<string, unknown>): Promise<void> => {
    const responseId = randomUUID();
    const upstream = await callOpenAiCompatibleUpstream({
      config: this.config,
      body,
    });
    const { responseResource } = buildBridgeResponsePayload({
      responseId,
      model: upstream.model,
      response: upstream.response,
    });

    this.jsonWriter.write(200, responseResource);
  };

  private writeErrorJson = (statusCode: number, message: string): void => {
    this.jsonWriter.write(statusCode, {
      error: {
        message,
      },
    });
  };
}

async function createCodexOpenAiResponsesBridge(
  config: CodexOpenAiResponsesBridgeRuntimeConfig,
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

    new JsonResponseWriter(response).write(404, {
      error: {
        message: `Unsupported Codex bridge path: ${pathname}`,
      },
    });
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
  config: CodexOpenAiResponsesBridgeRuntimeConfig,
): Promise<CodexOpenAiResponsesBridgeResult> {
  if (config.outputObserver) {
    return await createCodexOpenAiResponsesBridge(config);
  }

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
