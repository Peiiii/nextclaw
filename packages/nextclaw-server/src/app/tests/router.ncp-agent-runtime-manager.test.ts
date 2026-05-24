import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import {
  AgentRunRequestManager,
  ContextCompactionManager,
  NcpAgentSessionJournalStore,
  NcpSessionManager,
  SessionRunManager,
  type AgentRuntimeManager,
} from "@nextclaw/kernel";
import {
  NcpEventType,
  type NcpAgentConversationStateManager,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";
import { EventBus, Ingress } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

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

function createReplyingRuntimeManager(): AgentRuntimeManager {
  return {
    createRuntime: (params: { stateManager: NcpAgentConversationStateManager }): NcpAgentRuntime => ({
      run: async function* (input) {
        for (const message of input.messages) {
          await params.stateManager.dispatch({
            type: NcpEventType.MessageSent,
            payload: { sessionId: input.sessionId, message },
          });
        }
        const messageId = "assistant-message-1";
        const runId = (input as typeof input & { runId?: string }).runId ?? "run-1";
        const events: NcpEndpointEvent[] = [
          {
            type: NcpEventType.RunStarted,
            payload: { sessionId: input.sessionId, messageId, runId },
          },
          {
            type: NcpEventType.MessageTextStart,
            payload: { sessionId: input.sessionId, messageId },
          },
          {
            type: NcpEventType.MessageTextDelta,
            payload: { sessionId: input.sessionId, messageId, delta: "pong from runtime" },
          },
          {
            type: NcpEventType.MessageTextEnd,
            payload: { sessionId: input.sessionId, messageId },
          },
          {
            type: NcpEventType.MessageCompleted,
            payload: {
              sessionId: input.sessionId,
              message: {
                id: messageId,
                sessionId: input.sessionId,
                role: "assistant",
                status: "final",
                timestamp: "2026-05-23T00:00:00.000Z",
                parts: [{ type: "text", text: "pong from runtime" }],
              },
            },
          },
          {
            type: NcpEventType.RunFinished,
            payload: { sessionId: input.sessionId, messageId, runId },
          },
        ];
        for (const event of events) {
          await params.stateManager.dispatch(event);
          yield event;
        }
      },
    }),
    listSessionTypes: () => ({ defaultType: "native", options: [] }),
    resolveSessionMetadata: (metadata: Record<string, unknown>) => ({
      ...metadata,
      runtime: "native",
      session_type: "native",
      runtime_type: "native",
    }),
  } as unknown as AgentRuntimeManager;
}

it("routes ncp send through AgentRunRequestManager and stores the assistant reply", async () => {
  useIsolatedHome();
  const configPath = createTempConfigPath();
  saveConfig(ConfigSchema.parse({}), configPath);
  const ingress = new Ingress();
  const runtimeManager = createReplyingRuntimeManager();
  const eventBus = new EventBus();
  const sessionsDir = createTempDir("nextclaw-ui-ncp-runtime-sessions-");
  const configManager = { loadConfig: () => ConfigSchema.parse({}) };
  const ncpSessionManager = new NcpSessionManager({
    configManager: configManager as never,
    eventBus,
    journalStore: new NcpAgentSessionJournalStore(join(sessionsDir, ".ncp-agent-journal")),
    sessionSearch: { handleSessionUpdated: async () => undefined } as never,
  });
  const sessionRunManager = new SessionRunManager({
    agentRuntimeManager: runtimeManager,
    eventBus,
    ncpSessionManager,
  });
  const requestManager = new AgentRunRequestManager({
    contextCompactionManager: new ContextCompactionManager({
      configManager: configManager as never,
      sessionRunManager,
    }),
    ingress,
    ncpSessionManager,
    sessionRunManager,
  });
  requestManager.start();
  const app = createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: ({
      assetStore: {} as never,
      eventBus,
      ingress,
      listSessionTypes: runtimeManager.listSessionTypes,
      llmProviders: {} as never,
      ncpSessionManager,
    } as unknown as UiKernelHost),
  });

  try {
    const invalidSendResponse = await app.request("http://localhost/api/ncp/agent/send", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        content: [{ type: "text", text: "ambiguous" }],
        message: {
          id: "user-message-ambiguous",
          role: "user",
          status: "final",
          timestamp: "2026-03-17T00:00:00.000Z",
          parts: [{ type: "text", text: "ambiguous" }]
        },
      })
    });
    expect(invalidSendResponse.status).toBe(400);

    const sendResponse = await app.request("http://localhost/api/ncp/agent/send", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        metadata: {
          session_type: "native",
        },
        content: [
          { type: "text", text: "ping" },
          { type: "file", url: "https://example.com/a.pdf", name: "a.pdf" },
        ],
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
    expect(sendPayload.data.runId).toMatch(/^ncp-run-/);

    await vi.waitFor(async () => {
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
    });
  } finally {
    await requestManager.dispose();
    await sessionRunManager.dispose();
  }
});
