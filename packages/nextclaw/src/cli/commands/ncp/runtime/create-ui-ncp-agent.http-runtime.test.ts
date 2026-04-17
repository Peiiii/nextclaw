import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  ENV_HOME_KEY,
  MessageBus,
  SessionManager,
  type ProviderManager,
} from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent, type NcpRequestEnvelope } from "@nextclaw/ncp";
import {
  NARP_HTTP_RUNTIME_KIND,
} from "../builtin-narp-runtime-types.js";
import { createUiNcpAgent } from "../create-ui-ncp-agent.service.js";

const tempDirs: string[] = [];
const serverClosers: Array<() => Promise<void>> = [];
const agentDisposers: Array<() => Promise<void>> = [];
const originalHomeDir = process.env[ENV_HOME_KEY];

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-http-runtime-"));
  tempDirs.push(dir);
  return dir;
}

function useTempHomeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-http-home-"));
  tempDirs.push(dir);
  process.env[ENV_HOME_KEY] = dir;
  return dir;
}

afterEach(async () => {
  while (agentDisposers.length > 0) {
    const dispose = agentDisposers.pop();
    if (dispose) {
      await dispose();
    }
  }
  if (typeof originalHomeDir === "string") {
    process.env[ENV_HOME_KEY] = originalHomeDir;
  } else {
    delete process.env[ENV_HOME_KEY];
  }
  while (serverClosers.length > 0) {
    const close = serverClosers.pop();
    if (close) {
      await close();
    }
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createUiNcpAgent HTTP runtime session types", () => {
  it("lists narp-http as unavailable until baseUrl is configured", async () => {
    useTempHomeDir();
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "openai/gpt-5.4",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
        runtimes: {
          entries: {
            "mock-http": {
              label: "NARP HTTP",
              type: NARP_HTTP_RUNTIME_KIND,
              config: {},
            },
          },
        },
      },
    });

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new NoopProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
    });
    agentDisposers.push(async () => {
      await ncpAgent.dispose?.();
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "mock-http",
          label: "NARP HTTP",
          ready: false,
          reason: "base_url_missing",
        }),
      ]),
    );
  });

  it("lists narp-http as unavailable when the configured healthcheck is unreachable", async () => {
    useTempHomeDir();
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "openai/gpt-5.4",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
        runtimes: {
          entries: {
            hermes: {
              label: "Hermes",
              type: NARP_HTTP_RUNTIME_KIND,
              config: {
                label: "Hermes",
                baseUrl: "http://127.0.0.1:65530",
                healthcheckUrl: "http://127.0.0.1:65530/health",
                recommendedModel: "minimax/MiniMax-M2.7",
              },
            },
          },
        },
      },
    });

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new NoopProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
    });
    agentDisposers.push(async () => {
      await ncpAgent.dispose?.();
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "hermes",
          label: "Hermes",
          ready: false,
          reason: "healthcheck_unreachable",
          recommendedModel: "minimax/MiniMax-M2.7",
        }),
      ]),
    );
  });
});

describe("createUiNcpAgent HTTP runtime", () => {
  it("runs session messages through the configured HTTP adapter", async () => {
    useTempHomeDir();
    const workspace = createTempWorkspace();
    const adapter = await startMockHttpRuntimeServer();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "openai/gpt-5.4",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
        runtimes: {
          entries: {
            hermes: {
              label: "Hermes",
              type: NARP_HTTP_RUNTIME_KIND,
              config: {
                label: "Hermes",
                baseUrl: adapter.baseUrl,
                basePath: "/runtime",
                recommendedModel: "hermes/default",
                supportedModels: ["hermes/default"],
              },
            },
          },
        },
      },
    });

    const sessionManager = new SessionManager(workspace);
    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new NoopProviderManager() as unknown as ProviderManager,
      sessionManager,
      getConfig: () => config,
    });
    agentDisposers.push(async () => {
      await ncpAgent.dispose?.();
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "hermes",
          label: "Hermes",
          ready: true,
          recommendedModel: "hermes/default",
          supportedModels: ["hermes/default"],
        }),
      ]),
    );

    const runEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-http-runtime",
        text: "say hello from http runtime",
        metadata: {
          session_type: "hermes",
        },
      }),
    );

    expect(adapter.requests.send).toHaveLength(1);
    expect(adapter.requests.send[0]).toEqual(
      expect.objectContaining({
        sessionId: "session-http-runtime",
      }),
    );
    expect(runEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.RunStarted,
        NcpEventType.MessageTextDelta,
        NcpEventType.MessageCompleted,
        NcpEventType.RunFinished,
      ]),
    );
    expect(
      runEvents.some(
        (event) =>
          event.type === NcpEventType.MessageTextDelta &&
          String((event.payload as { delta?: unknown }).delta ?? "").includes("hello from mock http runtime"),
      ),
    ).toBe(true);

    const persistedSession = sessionManager.getIfExists("session-http-runtime");
    expect(persistedSession?.metadata.session_type).toBe("hermes");
    expect(persistedSession?.metadata.runtime_type).toBe(NARP_HTTP_RUNTIME_KIND);
    expect(
      persistedSession?.messages.some(
        (message) =>
          message.role === "assistant" &&
          String(message.content ?? "").includes("hello from mock http runtime"),
      ),
    ).toBe(true);
  });
});

class NoopProviderManager {
  get() {
    return {
      getDefaultModel: () => "default-model",
    };
  }
}

async function startMockHttpRuntimeServer(): Promise<{
  baseUrl: string;
  requests: {
    send: Array<Record<string, unknown>>;
    abort: Array<Record<string, unknown>>;
  };
}> {
  const requests = {
    send: [] as Array<Record<string, unknown>>,
    abort: [] as Array<Record<string, unknown>>,
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "POST" && url.pathname === "/runtime/send") {
      requests.send.push(await readJsonBody(request));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/runtime/stream") {
      const sessionId = url.searchParams.get("sessionId") ?? "missing-session";
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      response.write(
        toSseFrame({
          type: NcpEventType.RunStarted,
          payload: {
            sessionId,
            messageId: "assistant-http-runtime",
            runId: "run-http-runtime",
          },
        }),
      );
      response.write(
        toSseFrame({
          type: NcpEventType.MessageTextStart,
          payload: {
            sessionId,
            messageId: "assistant-http-runtime",
          },
        }),
      );
      response.write(
        toSseFrame({
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId,
            messageId: "assistant-http-runtime",
            delta: "hello from mock http runtime",
          },
        }),
      );
      response.write(
        toSseFrame({
          type: NcpEventType.MessageTextEnd,
          payload: {
            sessionId,
            messageId: "assistant-http-runtime",
          },
        }),
      );
      response.write(
        toSseFrame({
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId,
            message: {
              id: "assistant-http-runtime",
              sessionId,
              role: "assistant",
              status: "final",
              timestamp: "2026-04-15T00:00:00.000Z",
              parts: [{ type: "text", text: "hello from mock http runtime" }],
            },
          },
        }),
      );
      response.write(
        toSseFrame({
          type: NcpEventType.RunFinished,
          payload: {
            sessionId,
            messageId: "assistant-http-runtime",
            runId: "run-http-runtime",
          },
        }),
      );
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/runtime/abort") {
      requests.abort.push(await readJsonBody(request));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  serverClosers.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  );

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
  };
}

async function readJsonBody(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8").trim();
  if (!body) {
    return {};
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function toSseFrame(data: unknown): string {
  return `event: ncp-event\ndata: ${JSON.stringify(data)}\n\n`;
}

function createEnvelope(params: {
  sessionId: string;
  text: string;
  metadata?: Record<string, unknown>;
}): NcpRequestEnvelope {
  const { metadata, sessionId, text } = params;
  return {
    sessionId,
    message: {
      id: `${sessionId}:user:${Date.now()}`,
      sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text }],
      ...(metadata ? { metadata } : {}),
    },
    ...(metadata ? { metadata } : {}),
  };
}

async function sendAndCollectEvents(
  endpoint: {
    send(envelope: NcpRequestEnvelope): Promise<void>;
    subscribe(listener: (event: NcpEndpointEvent) => void): () => void;
  },
  envelope: NcpRequestEnvelope,
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  const unsubscribe = endpoint.subscribe((event) => {
    if (!("payload" in event)) {
      return;
    }
    const payload = event.payload;
    if (payload && "sessionId" in payload && payload.sessionId !== envelope.sessionId) {
      return;
    }
    events.push(event);
  });

  try {
    await endpoint.send(envelope);
    return events;
  } finally {
    unsubscribe();
  }
}
