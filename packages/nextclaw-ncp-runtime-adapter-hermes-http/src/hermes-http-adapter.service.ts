import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { DefaultNcpStreamEncoder } from "@nextclaw/ncp-agent-runtime";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpRequestEnvelope,
  type OpenAITool,
} from "@nextclaw/ncp";
import { HermesHttpAdapterConfigResolver } from "./hermes-http-adapter-config.utils.js";
import {
  buildHermesMessages,
  createAssistantMessageFromParts,
  HermesAssistantEventCollector,
  HermesInlineToolTraceTranslator,
  HermesReasoningDeltaTranslator,
  inferHermesProvider,
  normalizeHermesRequestedModel,
  readHermesProviderRoute,
  resolveHermesModel,
  type HermesProviderRoute,
  toErrorSseFrame,
  toNcpError,
  toNcpSseFrame,
} from "./hermes-http-adapter-message.utils.js";
import { parseHermesOpenAIChatStream } from "./hermes-openai-stream-parser.utils.js";
import { HermesHttpAdapterSessionStore } from "./hermes-http-adapter-session-store.service.js";
import type {
  HermesAdapterAssistantMessageFactory,
  HermesHttpAdapterResolvedConfig,
  HermesHttpAdapterRun,
  HermesHttpAdapterRunResult,
} from "./hermes-http-adapter.types.js";
import type { HermesHttpAdapterConfigInput } from "./hermes-http-adapter-config.utils.js";

function isUserVisibleAssistantEvent(event: NcpEndpointEvent): boolean {
  const eventType = event.type;
  return (
    eventType.startsWith("message.text-") ||
    eventType.startsWith("message.reasoning-") ||
    eventType.startsWith("message.tool-call-")
  );
}

class HermesHttpAdapterRouteService {
  private readonly sessions = new HermesHttpAdapterSessionStore();
  private readonly streamEncoder = new DefaultNcpStreamEncoder({
    reasoningNormalizationMode: "think-tags",
  });
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: HermesHttpAdapterResolvedConfig,
    private readonly buildAssistantMessage: HermesAdapterAssistantMessageFactory = createAssistantMessageFromParts,
  ) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  handle = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const requestUrl = new URL(request.url ?? "/", this.baseOrigin);
    const normalizedPath = requestUrl.pathname;

    if (request.method === "GET" && normalizedPath === "/health") {
      await this.handleHealth(response);
      return;
    }

    if (request.method === "POST" && normalizedPath === `${this.config.basePath}/send`) {
      await this.handleSend(request, response);
      return;
    }

    if (request.method === "GET" && normalizedPath === `${this.config.basePath}/stream`) {
      await this.handleStream(request, response, requestUrl);
      return;
    }

    if (request.method === "POST" && normalizedPath === `${this.config.basePath}/abort`) {
      await this.handleAbort(request, response);
      return;
    }

    this.writeJson(response, 404, {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `Unknown path: ${normalizedPath}`,
      },
    });
  };

  dispose = (): void => {
    this.sessions.dispose();
  };

  private get baseOrigin(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  private handleHealth = async (response: ServerResponse): Promise<void> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.healthcheckTimeoutMs);

    try {
      const upstream = await this.fetchImpl(this.config.healthcheckUrl, {
        method: "GET",
        signal: controller.signal,
      });
      if (!upstream.ok) {
        this.writeJson(response, 503, {
          status: "degraded",
          adapter: "ok",
          upstream: {
            status: "error",
            httpStatus: upstream.status,
          },
        });
        return;
      }
      this.writeJson(response, 200, {
        status: "ok",
        adapter: "ok",
        upstream: "ok",
      });
    } catch (error) {
      this.writeJson(response, 503, {
        status: "degraded",
        adapter: "ok",
        upstream: {
          status: "unreachable",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  private handleSend = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      const envelope = await this.readJsonBody<NcpRequestEnvelope>(request);
      if (!envelope?.sessionId || !envelope.message) {
        this.writeJson(response, 400, {
          ok: false,
          error: {
            code: "INVALID_BODY",
            message: "sessionId and message are required.",
          },
        });
        return;
      }

      const run: HermesHttpAdapterRun = {
        envelope,
        messageId: randomUUID(),
        runId: randomUUID(),
      };
      this.sessions.setPendingRun(run);
      this.writeJson(response, 200, { ok: true });
    } catch (error) {
      this.writeJson(response, 409, {
        ok: false,
        error: {
          code: "RUN_CONFLICT",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  private handleAbort = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      const payload = await this.readJsonBody<{ sessionId?: string }>(request);
      const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : "";
      if (!sessionId.trim()) {
        this.writeJson(response, 400, {
          ok: false,
          error: {
            code: "INVALID_BODY",
            message: "sessionId is required.",
          },
        });
        return;
      }
      const aborted = this.sessions.abortSession(sessionId);
      this.writeJson(response, 200, { ok: true, aborted });
    } catch (error) {
      this.writeJson(response, 500, {
        ok: false,
        error: {
          code: "ABORT_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  private handleStream = async (
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
  ): Promise<void> => {
    const sessionId = requestUrl.searchParams.get("sessionId")?.trim();
    if (!sessionId) {
      this.writeJson(response, 400, {
        ok: false,
        error: {
          code: "INVALID_QUERY",
          message: "sessionId is required.",
        },
      });
      return;
    }

    const connectionController = new AbortController();
    const runController = new AbortController();
    response.once("close", () => {
      connectionController.abort("client disconnected");
      runController.abort("client disconnected");
    });

    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    try {
      const run = await this.sessions.waitForPendingRun(
        sessionId,
        connectionController.signal,
        this.config.streamWaitTimeoutMs,
      );
      this.sessions.setActiveAbortController(sessionId, runController);

      const streamResult = await this.startRun({
        run,
        signal: runController.signal,
      });

      for await (const event of streamResult.events) {
        if (connectionController.signal.aborted) {
          break;
        }
        response.write(toNcpSseFrame(event));
      }
    } catch (error) {
      if (!connectionController.signal.aborted) {
        response.write(
          toErrorSseFrame({
            code: "STREAM_FAILED",
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    } finally {
      this.sessions.clearActiveAbortController(sessionId);
      response.end();
    }
  };

  private startRun = async (params: {
    run: HermesHttpAdapterRun;
    signal: AbortSignal;
  }): Promise<HermesHttpAdapterRunResult> => {
    const { run, signal } = params;
    const providerRoute = this.readProviderRoute(run.envelope);
    const requestedModel = normalizeHermesRequestedModel(resolveHermesModel({
      envelope: run.envelope,
      fallbackModel: this.config.model,
    }));
    if (!providerRoute) {
      await this.ensureHermesSessionModel({
        sessionId: run.envelope.sessionId,
        requestedModel,
        signal,
      });
    }

    const response = await this.fetchHermesChatCompletion({
      sessionId: run.envelope.sessionId,
      signal,
      stream: true,
      model: requestedModel,
      providerRoute,
      messages: buildHermesMessages({
        envelope: run.envelope,
        systemPrompt: this.config.systemPrompt,
      }),
      tools: run.envelope.tools,
    });
    if (!response.body) {
      throw new Error("[hermes-http-adapter] Hermes stream response body is missing.");
    }
    this.sessions.setSelectedModel(run.envelope.sessionId, requestedModel);

    return {
      events: this.createRunEvents({
        response,
        run,
        signal,
      }),
    };
  };

  private createRunEvents = async function* (
    this: HermesHttpAdapterRouteService,
    params: {
      response: Response;
      run: HermesHttpAdapterRun;
      signal: AbortSignal;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { response, run, signal } = params;
    const sessionId = run.envelope.sessionId;
    const providerRoute = this.readProviderRoute(run.envelope);
    const requestedModel = normalizeHermesRequestedModel(resolveHermesModel({
      envelope: run.envelope,
      fallbackModel: this.config.model,
    }));
    const metadata = {
      hermesModel: requestedModel,
    };
    let emittedUserVisibleAssistantEvent = false;
    const messageCollector = new HermesAssistantEventCollector();
    const inlineToolTraceTranslator = new HermesInlineToolTraceTranslator();
    const reasoningDeltaTranslator = new HermesReasoningDeltaTranslator();

    yield {
      type: NcpEventType.MessageAccepted,
      payload: {
        messageId: run.messageId,
        correlationId: run.envelope.correlationId,
      },
    };
    yield {
      type: NcpEventType.RunStarted,
      payload: {
        sessionId,
        messageId: run.messageId,
        runId: run.runId,
      },
    };

    try {
      for await (const event of reasoningDeltaTranslator.translate(
        inlineToolTraceTranslator.translate(
          this.streamEncoder.encode(
            parseHermesOpenAIChatStream(response.body as ReadableStream<Uint8Array>),
            {
              sessionId,
              messageId: run.messageId,
              runId: run.runId,
              correlationId: run.envelope.correlationId,
            },
          ),
        ),
      )) {
        messageCollector.applyEvent(event);
        if (isUserVisibleAssistantEvent(event)) {
          emittedUserVisibleAssistantEvent = true;
        }
        yield event;
      }

      if (!emittedUserVisibleAssistantEvent || !messageCollector.hasParts()) {
        throw new Error(
          `[hermes-http-adapter] Hermes completed without any assistant content for session ${sessionId}.`,
        );
      }

      const message = this.buildAssistantMessage({
        sessionId,
        messageId: run.messageId,
        parts: messageCollector.buildParts(),
        timestamp: new Date().toISOString(),
        metadata,
      });
      yield {
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId,
          message,
          correlationId: run.envelope.correlationId,
          metadata,
        },
      };
      yield {
        type: NcpEventType.RunFinished,
        payload: {
          sessionId,
          messageId: run.messageId,
          runId: run.runId,
        },
      };
    } catch (error) {
      if (signal.aborted) {
        const abortError = toNcpError(error, "abort-error");
        yield {
          type: NcpEventType.MessageFailed,
          payload: {
            sessionId,
            messageId: run.messageId,
            correlationId: run.envelope.correlationId,
            error: abortError,
          },
        };
        yield {
          type: NcpEventType.RunError,
          payload: {
            sessionId,
            messageId: run.messageId,
            runId: run.runId,
            error: abortError.message,
          },
        };
        return;
      }

      const runtimeError = toNcpError(error, "runtime-error");
      yield {
        type: NcpEventType.MessageFailed,
        payload: {
          sessionId,
          messageId: run.messageId,
          correlationId: run.envelope.correlationId,
          error: runtimeError,
        },
      };
      yield {
        type: NcpEventType.RunError,
        payload: {
          sessionId,
          messageId: run.messageId,
          runId: run.runId,
          error: runtimeError.message,
        },
      };
    }
  };

  private ensureHermesSessionModel = async (params: {
    sessionId: string;
    requestedModel: string;
    signal: AbortSignal;
  }): Promise<void> => {
    const { requestedModel, sessionId, signal } = params;
    const selectedModel = this.sessions.readSelectedModel(sessionId) ?? this.config.model;
    if (selectedModel === requestedModel) {
      return;
    }

    const response = await this.fetchHermesChatCompletion({
      sessionId,
      signal,
      stream: false,
      model: requestedModel,
      messages: [
        {
          role: "user",
          content: `/model ${requestedModel}`,
        },
      ],
    });

    const payload = await this.readJsonResponse<{
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
    }>(response);
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().startsWith("Error:")) {
      throw new Error(
        `[hermes-http-adapter] failed to switch Hermes model to ${requestedModel}: ${content.trim()}`,
      );
    }

    this.sessions.setSelectedModel(sessionId, requestedModel);
  };

  private fetchHermesChatCompletion = async (params: {
    sessionId: string;
    signal: AbortSignal;
    stream: boolean;
    model: string;
    providerRoute?: HermesProviderRoute;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    tools?: ReadonlyArray<OpenAITool>;
  }): Promise<Response> => {
    const { messages, model, providerRoute, sessionId, signal, stream, tools } = params;
    const headers = new Headers({
      "content-type": "application/json",
      accept: stream ? "text/event-stream" : "application/json",
    });
    if (this.config.hermesApiKey) {
      headers.set("authorization", `Bearer ${this.config.hermesApiKey}`);
    }

    const hermesSessionId = this.sessions.readHermesSessionId(sessionId);
    if (hermesSessionId) {
      headers.set("x-hermes-session-id", hermesSessionId);
    }

    const response = await this.fetchImpl(this.config.chatCompletionsUrl, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model,
        stream,
        messages,
        ...(providerRoute
          ? {
              nextclaw_provider_route:
                this.toHermesProviderRoutePayload(providerRoute),
            }
          : {}),
        ...(tools && tools.length > 0 ? { tools } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(
        `[hermes-http-adapter] Hermes request failed with HTTP ${response.status}.`,
      );
    }

    const returnedSessionId = response.headers.get("x-hermes-session-id")?.trim();
    if (returnedSessionId) {
      this.sessions.setHermesSessionId(sessionId, returnedSessionId);
    }

    return response;
  };

  private readProviderRoute = (
    envelope: NcpRequestEnvelope,
  ): HermesProviderRoute | undefined => {
    const providerRoute = readHermesProviderRoute(envelope);
    if (!providerRoute) {
      return undefined;
    }
    if (!providerRoute.apiBase) {
      throw new Error(
        `[hermes-http-adapter] missing provider apiBase for model "${providerRoute.model}". Configure the selected NextClaw provider before using Hermes.`,
      );
    }
    return providerRoute;
  };

  private toHermesProviderRoutePayload = (
    providerRoute: HermesProviderRoute,
  ): Record<string, unknown> => {
    const inferredProvider = inferHermesProvider(providerRoute);
    return {
      model: providerRoute.model,
      ...(inferredProvider ? { provider: inferredProvider } : {}),
      ...(providerRoute.apiKey ? { api_key: providerRoute.apiKey } : {}),
      ...(providerRoute.apiBase ? { base_url: providerRoute.apiBase } : {}),
      ...(providerRoute.apiMode ? { api_mode: providerRoute.apiMode } : {}),
      ...(Object.keys(providerRoute.headers).length > 0
        ? { extra_headers: providerRoute.headers }
        : {}),
    };
  };

  private readJsonResponse = async <T>(response: Response): Promise<T> => {
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new Error(
        `[hermes-http-adapter] expected JSON response from Hermes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  private readJsonBody = async <T>(request: IncomingMessage): Promise<T> => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString("utf8");
    if (!body.trim()) {
      throw new Error("request body is empty");
    }
    return JSON.parse(body) as T;
  };

  private writeJson = (
    response: ServerResponse,
    statusCode: number,
    payload: unknown,
  ): void => {
    response.writeHead(statusCode, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(payload));
  };
}

export class HermesHttpAdapterServer {
  readonly config: HermesHttpAdapterResolvedConfig;

  private readonly routeService: HermesHttpAdapterRouteService;
  private server: Server | null = null;

  constructor(configInput: HermesHttpAdapterConfigInput = {}) {
    this.config = new HermesHttpAdapterConfigResolver(configInput).resolve();
    this.routeService = new HermesHttpAdapterRouteService(this.config);
  }

  start = async (): Promise<void> => {
    if (this.server) {
      return;
    }
    const nextServer = createServer((request, response) => {
      void this.routeService.handle(request, response);
    });
    await new Promise<void>((resolve, reject) => {
      nextServer.once("error", reject);
      nextServer.listen(this.config.port, this.config.host, () => {
        nextServer.off("error", reject);
        resolve();
      });
    });
    this.server = nextServer;
  };

  stop = async (): Promise<void> => {
    this.routeService.dispose();
    const activeServer = this.server;
    if (!activeServer) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      activeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.server = null;
  };
}
