import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { ConfigSchema, saveConfig, SessionManager } from "@nextclaw/core";
import {
  AgentRunRequestManager,
  type AgentRuntimeManager,
} from "@nextclaw/kernel";
import {
  NcpEventType,
  type NcpAgentRuntime,
  type NcpMessage,
} from "@nextclaw/ncp";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";

const tempDirs: string[] = [];
const originalHome = process.env.NEXTCLAW_HOME;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTempConfigPath(): string {
  const dir = createTempDir("nextclaw-ui-ncp-runtime-config-");
  return join(dir, "config.json");
}

function useIsolatedHome(): void {
  process.env.NEXTCLAW_HOME = createTempDir("nextclaw-ui-ncp-runtime-home-");
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

function createAgentSessionStore() {
  const sessions = new Map<string, {
    sessionId: string;
    agentId?: string;
    messages: NcpMessage[];
    createdAt?: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
  }>();
  return {
    getSession: async (sessionId: string) => sessions.get(sessionId) ?? null,
    listSessions: async () => [...sessions.values()],
    listSessionMessages: async (sessionId: string) =>
      sessions.get(sessionId)?.messages ?? [],
    updateSessionMetadata: async (params: {
      sessionId: string;
      metadata: Record<string, unknown>;
      updatedAt: string;
    }) => {
      const { metadata, sessionId, updatedAt } = params;
      const session = sessions.get(sessionId);
      if (!session) {
        return false;
      }
      sessions.set(sessionId, {
        ...session,
        metadata,
        updatedAt,
      });
      return true;
    },
    saveSession: async (session: { sessionId: string; messages: NcpMessage[]; updatedAt: string }) => {
      sessions.set(session.sessionId, session as never);
    },
    deleteSession: async (sessionId: string) => {
      const session = sessions.get(sessionId) ?? null;
      sessions.delete(sessionId);
      return session;
    },
  } as never;
}

function createReplyingRuntimeManager(): AgentRuntimeManager {
  return {
    createRuntime: (): NcpAgentRuntime => ({
      run: async function* (input) {
        const messageId = "assistant-message-1";
        const runId = "run-1";
        yield {
          type: NcpEventType.RunStarted,
          payload: {
            sessionId: input.sessionId,
            messageId,
            runId,
          },
        };
        yield {
          type: NcpEventType.MessageTextStart,
          payload: {
            sessionId: input.sessionId,
            messageId,
          },
        };
        yield {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: input.sessionId,
            messageId,
            delta: "pong from runtime",
          },
        };
        yield {
          type: NcpEventType.MessageTextEnd,
          payload: {
            sessionId: input.sessionId,
            messageId,
          },
        };
        yield {
          type: NcpEventType.RunFinished,
          payload: {
            sessionId: input.sessionId,
            messageId,
            runId,
          },
        };
      },
    }),
    listSessionTypes: () => ({ defaultType: "native", options: [] }),
  } as unknown as AgentRuntimeManager;
}

it("routes ncp send through AgentRunRequestManager and stores the assistant reply", async () => {
  useIsolatedHome();
  const configPath = createTempConfigPath();
  saveConfig(ConfigSchema.parse({}), configPath);
  const manager = new AgentRunRequestManager({
    sessions: new SessionManager({
      sessionsDir: createTempDir("nextclaw-ui-ncp-runtime-sessions-"),
    }),
    ingress: {
      addHandler: () => () => undefined,
    } as never,
    agentRuntimeManager: createReplyingRuntimeManager(),
    ncpAgentSessionStore: createAgentSessionStore(),
    configManager: {
      loadConfig: () => ConfigSchema.parse({}),
    },
    eventBus: new EventBus(),
    handleNcpEvent: () => undefined,
    onSessionUpdated: () => undefined,
  });
  await manager.start();
  const app = createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    sessions: manager.sessionApi,
    agentRunRequests: manager,
  });

  try {
    const sendResponse = await app.request("http://localhost/api/ncp/agent/send", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        metadata: {
          session_type: "native",
        },
        message: {
          id: "user-message-1",
          role: "user",
          status: "final",
          timestamp: "2026-03-17T00:00:00.000Z",
          parts: [{ type: "text", text: "ping" }]
        }
      })
    });
    expect(sendResponse.status).toBe(200);
    const sendPayload = await sendResponse.json() as {
      ok: boolean;
      data: {
        sessionId: string;
        assistantMessageId: string | null;
        runId: string | null;
      };
    };
    expect(sendPayload.ok).toBe(true);
    expect(sendPayload.data.sessionId).toMatch(/^ncp-/);
    expect(sendPayload.data.assistantMessageId).toBe("assistant-message-1");
    expect(sendPayload.data.runId).toBe("run-1");

    const messagesResponse = await app.request(
      `http://localhost/api/ncp/sessions/${sendPayload.data.sessionId}/messages`,
    );
    expect(messagesResponse.status).toBe(200);
    const messagesPayload = await messagesResponse.json() as {
      ok: boolean;
      data: {
        messages: Array<{
          role: string;
          parts: Array<{ type: string; text?: string }>;
        }>;
      };
    };
    expect(messagesPayload.ok).toBe(true);
    expect(messagesPayload.data.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          parts: [{ type: "text", text: "pong from runtime" }],
        }),
      ]),
    );
  } finally {
    await manager.dispose();
  }
});
