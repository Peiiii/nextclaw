import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpAgentClientEndpoint,
  type NcpEndpointEvent,
  type NcpSessionApi
} from "@nextclaw/ncp";
import type { NcpHttpAgentStreamProvider } from "@nextclaw/ncp-http-agent-server";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];
const originalHome = process.env.NEXTCLAW_HOME;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTempConfigPath(): string {
  const dir = createTempDir("nextclaw-ui-ncp-config-");
  return join(dir, "config.json");
}

function useIsolatedHome(): void {
  process.env.NEXTCLAW_HOME = createTempDir("nextclaw-ui-ncp-home-");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  if (typeof originalHome === "string") {
    process.env.NEXTCLAW_HOME = originalHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
});

class StubNcpAgent implements NcpAgentClientEndpoint, NcpSessionApi {
  readonly manifest = {
    endpointKind: "agent" as const,
    endpointId: "stub-ncp-agent",
    version: "0.1.0",
    supportsStreaming: true,
    supportsAbort: true,
    supportsProactiveMessages: false,
    supportsLiveSessionStream: true,
    supportedPartTypes: ["text"] as const,
    expectedLatency: "seconds" as const
  };

  private readonly listeners = new Set<(event: NcpEndpointEvent) => void>();
  readonly abortCalls: Array<{ sessionId: string; messageId?: string }> = [];
  readonly sessionTypeListCalls: Array<{ describeMode?: "observation" | "probe" } | undefined> = [];

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  subscribe(listener: (event: NcpEndpointEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async emit(event: NcpEndpointEvent): Promise<void> {
    if (event.type === NcpEventType.MessageRequest) {
      this.publish({
        type: NcpEventType.RunStarted,
        payload: {
          sessionId: event.payload.sessionId,
          messageId: "assistant-message-1",
          runId: "run-1"
        }
      });
      this.publish({
        type: NcpEventType.RunFinished,
        payload: {
          sessionId: event.payload.sessionId,
          messageId: "assistant-message-1",
          runId: "run-1"
        }
      });
      return;
    }
    if (event.type === NcpEventType.MessageAbort) {
      await this.abort(event.payload);
    }
  }

  async send(): Promise<void> {}

  async stream(): Promise<void> {}

  async abort(payload: { sessionId: string; messageId?: string }): Promise<void> {
    this.abortCalls.push(payload);
  }

  async listSessions() {
    return [
      {
        sessionId: "session-1",
        messageCount: 2,
        updatedAt: "2026-03-17T00:00:00.000Z",
        status: "idle" as const
      }
    ];
  }

  async listSessionMessages() {
    return [
      {
        id: "msg-1",
        sessionId: "session-1",
        role: "user" as const,
        status: "final" as const,
        timestamp: "2026-03-17T00:00:00.000Z",
        parts: [{ type: "text" as const, text: "hello" }]
      }
    ];
  }

  async getSession(sessionId: string) {
    if (sessionId !== "session-1") {
      return null;
    }
    return {
      sessionId,
      messageCount: 2,
      updatedAt: "2026-03-17T00:00:00.000Z",
      status: "idle" as const
    };
  }

  async updateSession(sessionId: string, patch: { metadata?: Record<string, unknown> | null }) {
    if (sessionId !== "session-1") {
      return null;
    }
    return {
      sessionId,
      messageCount: 2,
      updatedAt: "2026-03-17T00:00:00.000Z",
      status: "idle" as const,
      ...(patch.metadata ? { metadata: patch.metadata } : {})
    };
  }

  async deleteSession(): Promise<void> {}

  async listSessionTypes(params?: { describeMode?: "observation" | "probe" }) {
    this.sessionTypeListCalls.push(params);
    return {
      defaultType: "native",
      options: [
        { value: "native", label: "Native" },
        { value: "codex", label: "Codex" },
      ],
    };
  }

  private publish(event: NcpEndpointEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe("ncp ui routes", () => {
  it("mounts parallel ncp agent and session routes", async () => {
    useIsolatedHome();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const agent = new StubNcpAgent();
    const streamProvider: NcpHttpAgentStreamProvider = {
      stream: async function* () {
        yield {
          type: NcpEventType.RunFinished,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-message-1",
            runId: "run-1"
          }
        };
      }
    };
    const app = createUiRouter({
      configPath,
      publish: () => {},
      ncpAgent: {
        agentClientEndpoint: agent,
        streamProvider,
        sessionApi: agent,
        listSessionTypes: (params) => agent.listSessionTypes(params),
      }
    });

    const sessionsResponse = await app.request("http://localhost/api/ncp/sessions");
    expect(sessionsResponse.status).toBe(200);
    const sessionsPayload = await sessionsResponse.json() as {
      ok: boolean;
      data: {
        total: number;
        sessions: Array<{ sessionId: string }>;
      };
    };
    expect(sessionsPayload.ok).toBe(true);
    expect(sessionsPayload.data.total).toBe(1);
    expect(sessionsPayload.data.sessions[0]?.sessionId).toBe("session-1");

    const messagesResponse = await app.request("http://localhost/api/ncp/sessions/session-1/messages");
    expect(messagesResponse.status).toBe(200);
    const messagesPayload = await messagesResponse.json() as {
      ok: boolean;
      data: {
        total: number;
        messages: Array<{ id: string }>;
      };
    };
    expect(messagesPayload.ok).toBe(true);
    expect(messagesPayload.data.total).toBe(1);
    expect(messagesPayload.data.messages[0]?.id).toBe("msg-1");

    const sessionTypesResponse = await app.request("http://localhost/api/ncp/session-types");
    expect(sessionTypesResponse.status).toBe(200);
    const sessionTypesPayload = await sessionTypesResponse.json() as {
      ok: boolean;
      data: {
        defaultType: string;
        options: Array<{ value: string; label: string }>;
      };
    };
    expect(sessionTypesPayload.ok).toBe(true);
    expect(sessionTypesPayload.data).toEqual({
      defaultType: "native",
      options: [
        { value: "native", label: "Native" },
        { value: "codex", label: "Codex" },
      ],
    });
    expect(agent.sessionTypeListCalls).toEqual([{ describeMode: "observation" }]);

    const patchResponse = await app.request("http://localhost/api/ncp/sessions/session-1", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        preferredModel: "openai/gpt-5",
        preferredThinking: "medium"
      })
    });
    expect(patchResponse.status).toBe(200);
    const patchPayload = await patchResponse.json() as {
      ok: boolean;
      data: {
        metadata?: Record<string, unknown>;
      };
    };
    expect(patchPayload.ok).toBe(true);
    expect(patchPayload.data.metadata).toMatchObject({
      preferred_model: "openai/gpt-5",
      preferred_thinking: "medium"
    });

    const sendResponse = await app.request("http://localhost/api/ncp/agent/send", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId: "session-1",
        message: {
          id: "user-message-1",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: "2026-03-17T00:00:00.000Z",
          parts: [{ type: "text", text: "hello" }]
        }
      })
    });
    expect(sendResponse.status).toBe(200);
    expect(sendResponse.headers.get("content-type")).toContain("text/event-stream");
    const sendText = await sendResponse.text();
    expect(sendText).toContain("\"type\":\"run.started\"");
    expect(sendText).toContain("\"type\":\"run.finished\"");

    const abortResponse = await app.request("http://localhost/api/ncp/agent/abort", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId: "session-1"
      })
    });
    expect(abortResponse.status).toBe(200);
    expect(agent.abortCalls).toEqual([{ sessionId: "session-1" }]);
  });
});
