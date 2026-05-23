import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "./router.js";
import type { UiKernelHost } from "./types/router-options.types.js";

const tempDirs: string[] = [];
const originalHome = process.env.NEXTCLAW_HOME;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTempConfigPath(): string {
  return join(createTempDir("nextclaw-ui-ncp-stream-config-"), "config.json");
}

function useIsolatedHome(): void {
  process.env.NEXTCLAW_HOME = createTempDir("nextclaw-ui-ncp-stream-home-");
}

function createKernel(streamEvents: NcpEndpointEvent[]): UiKernelHost {
  return {
    agentRuntimeManager: {
      listSessionTypes: () => ({ defaultType: "native", options: [] }),
    },
    assetStore: {},
    ingress: {},
    llmProviders: {},
    ncpSessionManager: {},
    sessionRunManager: {
      streamSessionEvents: async function* (): AsyncGenerator<NcpEndpointEvent> {
        for (const event of streamEvents) {
          yield event;
        }
      },
    },
  } as unknown as UiKernelHost;
}

function createTestApp(streamEvents: NcpEndpointEvent[]): ReturnType<typeof createUiRouter> {
  useIsolatedHome();
  const configPath = createTempConfigPath();
  saveConfig(ConfigSchema.parse({}), configPath);
  return createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: createKernel(streamEvents),
  });
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

it("streams context-window updates through the ncp agent SSE route", async () => {
  const app = createTestApp([
    {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId: "session-1",
        contextWindow: {
          usedContextTokens: 12,
          totalContextTokens: 100,
        },
      },
    },
  ]);

  const response = await app.request("http://localhost/api/ncp/agent/stream?sessionId=session-1");
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  expect(body).toContain("event: ncp-event");
  expect(body).toContain("\"type\":\"context-window.updated\"");
  expect(body).toContain("\"usedContextTokens\":12");
});
