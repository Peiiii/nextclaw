import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createConfigPath(): string {
  const dir = createTempDir("nextclaw-ncp-session-list-route-");
  const configPath = join(dir, "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  return configPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

it("passes peerId filters through the ncp session list route", async () => {
  const listSessionCalls: Array<{ limit?: number; peerId?: string }> = [];
  const app = createUiRouter({
    configPath: createConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({
      sessionManager: {
        listSessions: async (options?: { limit?: number; peerId?: string }) => {
          const { limit, peerId } = options ?? {};
          listSessionCalls.push({
            ...(typeof limit === "number" ? { limit } : {}),
            ...(peerId ? { peerId } : {}),
          });
          return peerId === "peer-1"
            ? [{
                sessionId: "session-1",
                peerId: "peer-1",
                messageCount: 2,
                updatedAt: "2026-03-17T00:00:00.000Z",
              }]
            : [];
        },
      } as never,
    }),
  });

  const response = await app.request("http://localhost/api/ncp/sessions?peerId=peer-1&limit=10");
  const payload = await response.json() as {
    ok: boolean;
    data: {
      total: number;
      sessions: Array<{ peerId?: string; sessionId: string }>;
    };
  };

  expect(response.status).toBe(200);
  expect(payload.ok).toBe(true);
  expect(payload.data.total).toBe(1);
  expect(payload.data.sessions[0]).toMatchObject({
    peerId: "peer-1",
    sessionId: "session-1",
  });
  expect(listSessionCalls).toEqual([{ limit: 10, peerId: "peer-1" }]);
});

it("completes idle running previews that already have a final reply", async () => {
  const app = createUiRouter({
    configPath: createConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({
      sessionManager: {
        getSession: async () => ({
          sessionId: "session-1",
          messageCount: 1,
          updatedAt: "2026-03-17T00:00:00.000Z",
          status: "idle",
          metadata: {
            last_activity_preview: {
              state: "running",
              timestamp: "2026-03-17T00:00:01.000Z",
              statusText: "Thinking",
              replyText: "上一条回复",
            },
          },
        }),
      } as never,
    }),
  });

  const response = await app.request("http://localhost/api/ncp/sessions/session-1");
  const payload = await response.json() as {
    data: { metadata?: { last_activity_preview?: { state?: string; statusText?: string; replyText?: string } } };
  };

  expect(payload.data.metadata?.last_activity_preview).toMatchObject({
    state: "completed",
    statusText: "Thinking",
    replyText: "上一条回复",
  });
});

it("marks idle running previews without a final reply as interrupted", async () => {
  const app = createUiRouter({
    configPath: createConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({
      sessionManager: {
        getSession: async () => ({
          sessionId: "session-1",
          messageCount: 1,
          updatedAt: "2026-03-17T00:00:00.000Z",
          status: "idle",
          metadata: {
            last_activity_preview: {
              state: "running",
              timestamp: "2026-03-17T00:00:01.000Z",
              statusText: "Thinking",
            },
          },
        }),
      } as never,
    }),
  });

  const response = await app.request("http://localhost/api/ncp/sessions/session-1");
  const payload = await response.json() as {
    data: { metadata?: { last_activity_preview?: { state?: string; statusText?: string; replyText?: string } } };
  };

  expect(payload.data.metadata?.last_activity_preview).toMatchObject({
    state: "failed",
    statusText: "Run interrupted: no completion or error event was recorded. Please send the message again.",
  });
});

it("normalizes legacy user-cancelled failed previews as cancelled", async () => {
  const app = createUiRouter({
    configPath: createConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({
      sessionManager: {
        getSession: async () => ({
          sessionId: "session-1",
          messageCount: 1,
          updatedAt: "2026-03-17T00:00:00.000Z",
          status: "idle",
          metadata: {
            last_activity_preview: {
              state: "failed",
              timestamp: "2026-03-17T00:00:01.000Z",
              statusText: "Run interrupted: User stopped the current run.",
            },
          },
        }),
      } as never,
    }),
  });

  const response = await app.request("http://localhost/api/ncp/sessions/session-1");
  const payload = await response.json() as {
    data: { metadata?: { last_activity_preview?: { state?: string; statusText?: string } } };
  };

  expect(payload.data.metadata?.last_activity_preview).toMatchObject({
    state: "cancelled",
    statusText: "Run interrupted: User stopped the current run.",
  });
});

it("keeps running previews for sessions that are still active", async () => {
  const app = createUiRouter({
    configPath: createConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({
      isSessionRunning: (sessionId: string) => sessionId === "session-1",
      sessionManager: {
        getSession: async () => ({
          sessionId: "session-1",
          messageCount: 1,
          updatedAt: "2026-03-17T00:00:00.000Z",
          status: "idle",
          metadata: {
            last_activity_preview: {
              state: "running",
              timestamp: "2026-03-17T00:00:01.000Z",
              statusText: "Thinking",
            },
          },
        }),
      } as never,
    }),
  });

  const response = await app.request("http://localhost/api/ncp/sessions/session-1");
  const payload = await response.json() as {
    data: { status: string; metadata?: { last_activity_preview?: { state?: string; statusText?: string } } };
  };

  expect(payload.data.status).toBe("running");
  expect(payload.data.metadata?.last_activity_preview).toMatchObject({
    state: "running",
    statusText: "Thinking",
  });
});
