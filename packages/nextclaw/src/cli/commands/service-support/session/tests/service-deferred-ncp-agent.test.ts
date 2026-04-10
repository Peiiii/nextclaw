import { describe, expect, it, vi } from "vitest";
import type { UiNcpAgentHandle } from "../../../ncp/create-ui-ncp-agent.js";
import { createDeferredUiNcpAgent } from "../service-deferred-ncp-agent.js";

function createAgentHandle(): UiNcpAgentHandle {
  const stop = vi.fn(async () => undefined);
  const send = vi.fn(async () => undefined);
  const stream = vi.fn(async () => undefined);
  const abort = vi.fn(async () => undefined);
  const subscribe = vi.fn(() => () => undefined);
  const listSessionTypes = vi.fn(async () => ({
    defaultType: "native",
    options: [{ value: "native", label: "Native" }],
  }));
  const assetApi = {
    put: vi.fn(async () => ({
      id: "asset-1",
      uri: "asset://store/asset-1",
      storageKey: "store/asset-1",
      fileName: "a.txt",
      storedName: "asset-1.txt",
      mimeType: "text/plain",
      sizeBytes: 1,
      createdAt: new Date().toISOString(),
      sha256: "hash",
    })),
    stat: vi.fn(async () => null),
    resolveContentPath: vi.fn(() => null),
  };

  return {
    basePath: "/api/ncp/agent",
    agentClientEndpoint: {
      manifest: {
        endpointKind: "agent",
        endpointId: "test-agent",
        version: "1.0.0",
        supportsStreaming: true,
        supportsAbort: true,
        supportsProactiveMessages: false,
        supportsLiveSessionStream: true,
        supportedPartTypes: ["text"],
        expectedLatency: "seconds",
      },
      start: vi.fn(async () => undefined),
      stop,
      emit: vi.fn(async () => undefined),
      subscribe,
      send,
      stream,
      abort,
    },
    runApi: {
      send: vi.fn(async function* () {
        yield* [];
      }),
      stream: vi.fn(async function* () {
        yield* [];
      }),
      abort: vi.fn(async () => undefined),
    },
    sessionApi: {
      listSessions: vi.fn(async () => []),
      listSessionMessages: vi.fn(async () => []),
      getSession: vi.fn(async () => null),
      updateSession: vi.fn(async () => null),
      deleteSession: vi.fn(async () => undefined),
    },
    streamProvider: {
      stream: vi.fn(async function* () {
        yield* [];
      }),
    },
    listSessionTypes,
    assetApi,
    applyExtensionRegistry: vi.fn(),
    applyMcpConfig: vi.fn(async () => undefined),
  };
}

describe("createDeferredUiNcpAgent", () => {
  it("rejects transport calls before activation", async () => {
    const deferred = createDeferredUiNcpAgent();

    await expect(
      deferred.agent.agentClientEndpoint.send({
        sessionId: "s1",
        correlationId: "c1",
        message: {
          id: "m1",
          sessionId: "s1",
          role: "user",
          parts: [{ type: "text", text: "hi" }],
          status: "final",
          timestamp: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow("ncp agent unavailable during startup");

    expect(deferred.agent.listSessionTypes).toBeUndefined();
    expect(deferred.isReady()).toBe(false);
  });

  it("activates, delegates, and clears runtime capabilities", async () => {
    const deferred = createDeferredUiNcpAgent();
    const handle = createAgentHandle();

    deferred.activate(handle);

    expect(deferred.isReady()).toBe(true);
    expect(deferred.agent.listSessionTypes).toBe(handle.listSessionTypes);
    expect(deferred.agent.assetApi).toBe(handle.assetApi);

    await deferred.agent.agentClientEndpoint.send({
      sessionId: "s1",
      correlationId: "c1",
      message: {
        id: "m1",
        sessionId: "s1",
        role: "user",
        parts: [{ type: "text", text: "hi" }],
        status: "final",
        timestamp: new Date().toISOString(),
      },
    });

    expect(handle.agentClientEndpoint.send).toHaveBeenCalledTimes(1);

    await deferred.close();

    expect(handle.agentClientEndpoint.stop).toHaveBeenCalledTimes(1);
    expect(deferred.agent.listSessionTypes).toBeUndefined();
    expect(deferred.agent.assetApi).toBeUndefined();
    expect(deferred.isReady()).toBe(false);
  });
});
