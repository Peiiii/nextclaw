import { afterEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
} from "../../builtin-narp-runtime-types.js";
import { HermesHttpAdapterServer } from "../../../../../../../nextclaw-ncp-runtime-adapter-hermes-http/src/index.js";
import { createUiNcpAgent } from "./create-ui-ncp-agent.service.js";

const tempDirs: string[] = [];
const serverClosers: Array<() => Promise<void>> = [];
const agentDisposers: Array<() => Promise<void>> = [];
const originalHomeDir = process.env[ENV_HOME_KEY];

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

describe("createUiNcpAgent Hermes HTTP runtime", () => {
  it("runs through the Hermes adapter server and persists assistant output", async () => {
    useTempHomeDir();
    const workspace = createTempWorkspace();
    const hermes = await startMockHermesServer();
    const adapter = await startAdapterServer(hermes.baseUrl);
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
                icon: {
                  kind: "image",
                  src: "app://runtime-icons/hermes-agent.png",
                  alt: "Hermes",
                },
              type: NARP_HTTP_RUNTIME_KIND,
              config: {
                label: "Hermes",
                baseUrl: adapter.baseUrl,
                basePath: "/ncp/agent",
                healthcheckUrl: `${adapter.baseUrl}/health`,
                recommendedModel: "hermes-agent",
              },
            },
          },
        },
      },
      providers: {
        minimax: {
          enabled: true,
          displayName: "MiniMax",
          apiKey: "minimax-key",
          apiBase: "https://api.minimax.chat/v1",
          extraHeaders: {
            "x-minimax-group-id": "group-123",
          },
          models: ["MiniMax-M2.7"],
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
          icon: {
            kind: "image",
            src: "app://runtime-icons/hermes-agent.png",
            alt: "Hermes",
          },
          ready: true,
        }),
      ]),
    );
    expect(sessionTypes?.options.find((option) => option.value === "hermes")?.supportedModels)
      .toBeUndefined();

    const runEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-hermes-e2e",
        text: "hello from nextclaw hermes adapter",
        metadata: {
          session_type: "hermes",
          preferred_model: "minimax/MiniMax-M2.7",
        },
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
          String((event.payload as { delta?: unknown }).delta ?? "").includes("hello from hermes"),
      ),
    ).toBe(true);

    const persistedSession = sessionManager.getIfExists("session-hermes-e2e");
    expect(persistedSession?.metadata.session_type).toBe("hermes");
    expect(persistedSession?.metadata.runtime_type).toBe(NARP_HTTP_RUNTIME_KIND);
    expect(
      persistedSession?.messages.some(
        (message) =>
          message.role === "assistant" &&
          String(message.content ?? "").includes("hello from hermes"),
      ),
    ).toBe(true);

    expect(hermes.requests.chat).toHaveLength(1);
    expect(hermes.requests.chat[0]?.model).toBe("MiniMax-M2.7");
    expect(hermes.requests.chat[0]?.nextclaw_provider_route).toEqual({
      model: "MiniMax-M2.7",
      provider: "openai",
      api_key: "minimax-key",
      base_url: "https://api.minimax.chat/v1",
      api_mode: "chat_completions",
      extra_headers: {
        "x-minimax-group-id": "group-123",
      },
    });
    expect(
      ((hermes.requests.chat[0]?.tools as Array<{ function?: { name?: string } }> | undefined) ?? [])
        .map((tool) => tool.function?.name),
    ).toContain("list_dir");
  });

  it("surfaces empty Hermes completions as run errors in the UI agent flow", async () => {
    useTempHomeDir();
    const workspace = createTempWorkspace();
    const hermes = await startMockHermesServer({
      mode: "empty",
    });
    const adapter = await startAdapterServer(hermes.baseUrl);
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
                basePath: "/ncp/agent",
                healthcheckUrl: `${adapter.baseUrl}/health`,
                recommendedModel: "hermes-agent",
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

    const runEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-hermes-empty",
        text: "hello from nextclaw hermes adapter",
        metadata: {
          session_type: "hermes",
        },
      }),
    );

    expect(runEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        NcpEventType.RunStarted,
        NcpEventType.MessageFailed,
        NcpEventType.RunError,
      ]),
    );
    expect(runEvents.some((event) => event.type === NcpEventType.MessageCompleted)).toBe(false);
    expect(runEvents.some((event) => event.type === NcpEventType.RunFinished)).toBe(false);

    const persistedSession = sessionManager.getIfExists("session-hermes-empty");
    expect(persistedSession?.messages.some((message) => message.role === "assistant")).toBe(false);
  });
});

class NoopProviderManager {
  get() {
    return {
      getDefaultModel: () => "default-model",
    };
  }
}

function createEnvelope(params: {
  sessionId: string;
  text: string;
  metadata?: Record<string, unknown>;
}): NcpRequestEnvelope {
  return {
    sessionId: params.sessionId,
    message: {
      id: `${params.sessionId}-user`,
      sessionId: params.sessionId,
      role: "user",
      status: "final",
      parts: [{ type: "text", text: params.text }],
      timestamp: new Date().toISOString(),
    },
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };
}

async function sendAndCollectEvents(
  endpoint: {
    subscribe(listener: (event: NcpEndpointEvent) => void): () => void;
    emit(event: NcpEndpointEvent): Promise<void>;
  },
  envelope: NcpRequestEnvelope,
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  const unsubscribe = endpoint.subscribe((event) => {
    events.push(event);
  });

  await endpoint.emit({
    type: NcpEventType.MessageRequest,
    payload: envelope,
  });

  unsubscribe();
  return events;
}

async function startAdapterServer(hermesBaseUrl: string): Promise<{
  baseUrl: string;
}> {
  const adapterPort = await getFreePort();
  const adapter = new HermesHttpAdapterServer({
    host: "127.0.0.1",
    port: adapterPort,
    hermesBaseUrl,
    hermesApiKey: "test-key",
  });
  await adapter.start();
  serverClosers.push(async () => {
    await adapter.stop();
  });
  return {
    baseUrl: `http://127.0.0.1:${adapterPort}`,
  };
}

async function startMockHermesServer(options: {
  mode?: "normal" | "empty";
} = {}): Promise<{
  baseUrl: string;
  requests: {
    chat: Array<Record<string, unknown>>;
  };
}> {
  const requests = {
    chat: [] as Array<Record<string, unknown>>,
  };
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
      requests.chat.push(body);
      const sessionId =
        (typeof request.headers["x-hermes-session-id"] === "string" &&
          request.headers["x-hermes-session-id"].trim()) ||
        "hermes-session-e2e";
      const firstMessage = Array.isArray(body.messages)
        ? (body.messages[0] as { content?: unknown } | undefined)
        : undefined;
      const firstContent =
        firstMessage && typeof firstMessage.content === "string"
          ? firstMessage.content.trim()
          : "";
      if (!body.stream && firstContent.startsWith("/model ")) {
        const requestedModel = firstContent.slice("/model ".length).trim();
        sessionModels.set(sessionId, requestedModel);
        response.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "x-hermes-session-id": sessionId,
        });
        response.end(
          JSON.stringify({
            id: "chatcmpl-model-switch",
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
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "x-hermes-session-id": sessionId,
      });
      response.write(
        `data: ${JSON.stringify({
          id: "chatcmpl-e2e",
          choices: [{ delta: { role: "assistant" }, finish_reason: null }],
        })}\n\n`,
      );
      if (options.mode === "empty") {
        response.write(
          `data: ${JSON.stringify({
            id: "chatcmpl-e2e",
            choices: [{ delta: {}, finish_reason: "stop" }],
          })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
      }
      response.write(
        `data: ${JSON.stringify({
          id: "chatcmpl-e2e",
          choices: [
            {
              delta: {
                content: `hello from hermes e2e model=${sessionModels.get(sessionId) ?? body.model ?? "unknown-model"}`,
              },
              finish_reason: null,
            },
          ],
        })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({
          id: "chatcmpl-e2e",
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
  serverClosers.push(async () => {
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
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-hermes-http-runtime-"));
  tempDirs.push(dir);
  return dir;
}

function useTempHomeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-hermes-http-home-"));
  tempDirs.push(dir);
  process.env[ENV_HOME_KEY] = dir;
  return dir;
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
