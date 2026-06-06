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
