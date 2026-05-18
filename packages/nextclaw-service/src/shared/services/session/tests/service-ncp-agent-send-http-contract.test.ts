import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import type { AgentRuntimeHandle } from "@nextclaw/kernel";
import type { NcpAgentSendEnvelope } from "@nextclaw/ncp";
import { startUiServer } from "@nextclaw/server";
import { EventBus } from "@nextclaw/shared";
import { createDeferredUiNcpAgent } from "../service-deferred-ncp-agent.service.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-service-ncp-send-contract-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

async function reservePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve test port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function createAgentHandle(): AgentRuntimeHandle {
  return {
    basePath: "/api/ncp/agent",
    agentClientEndpoint: {
      manifest: {
        endpointKind: "agent",
        endpointId: "contract-agent",
        version: "1.0.0",
        supportsStreaming: true,
        supportsAbort: true,
        supportsProactiveMessages: false,
        supportsLiveSessionStream: true,
        supportedPartTypes: ["text"],
        expectedLatency: "seconds",
      },
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      emit: vi.fn(async () => undefined),
      subscribe: vi.fn(() => () => undefined),
      send: vi.fn(async (envelope: NcpAgentSendEnvelope) => ({
        sessionId: envelope.sessionId ?? envelope.message.sessionId ?? "session-created",
        userMessageId: envelope.message.id,
        assistantMessageId: "assistant-message-1",
        runId: "run-1",
        ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
      })),
      stream: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    },
    sessionApi: {
      listSessions: vi.fn(async () => []),
      listSessionMessages: vi.fn(async () => []),
      getSession: vi.fn(async () => null),
      updateSession: vi.fn(async () => null),
      deleteSession: vi.fn(async () => undefined),
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
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("service NCP send HTTP contract", () => {
  it("returns the command handle through the deferred service agent route", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const deferredAgent = createDeferredUiNcpAgent();
    const runtimeHandle = createAgentHandle();
    deferredAgent.activate(runtimeHandle);
    const port = await reservePort();
    const server = await startUiServer({
      configPath,
      appEventBus: new EventBus(),
      uiConfig: {
        enabled: true,
        host: "127.0.0.1",
        open: false,
        port,
      },
      ncpAgent: deferredAgent.agent,
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/ncp/agent/send`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "session-1",
          correlationId: "correlation-1",
          message: {
            id: "user-message-1",
            sessionId: "session-1",
            role: "user",
            status: "final",
            timestamp: "2026-05-18T00:00:00.000Z",
            parts: [{ type: "text", text: "hello" }],
          },
        }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        data: {
          sessionId: "session-1",
          userMessageId: "user-message-1",
          assistantMessageId: "assistant-message-1",
          runId: "run-1",
          correlationId: "correlation-1",
        },
      });
      expect(runtimeHandle.agentClientEndpoint.send).toHaveBeenCalledTimes(1);
    } finally {
      await server.close();
      await deferredAgent.close();
    }
  });
});
