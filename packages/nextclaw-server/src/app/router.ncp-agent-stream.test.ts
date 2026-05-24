import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { NcpEventType } from "@nextclaw/ncp";
import { EventBus, eventKeys } from "@nextclaw/shared";
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

function createKernel(eventBus: EventBus): UiKernelHost {
  return {
    listSessionTypes: async () => ({ defaultType: "native", options: [] }),
    assetStore: {},
    eventBus,
    ingress: {},
    llmProviders: {},
    ncpSessionManager: {},
  } as unknown as UiKernelHost;
}

function createTestApp(eventBus: EventBus): ReturnType<typeof createUiRouter> {
  useIsolatedHome();
  const configPath = createTempConfigPath();
  saveConfig(ConfigSchema.parse({}), configPath);
  return createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: createKernel(eventBus),
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
  const eventBus = new EventBus();
  const app = createTestApp(eventBus);
  const controller = new AbortController();
  const response = await app.request(
    new Request("http://localhost/api/ncp/agent/stream?sessionId=session-1", {
      signal: controller.signal,
    }),
  );
  const reader = response.body?.getReader();
  eventBus.emit(eventKeys.ncpEvent, {
    type: NcpEventType.ContextWindowUpdated,
    payload: {
      sessionId: "session-1",
      contextWindow: {
        usedContextTokens: 12,
        totalContextTokens: 100,
      },
    },
  });
  const chunk = await reader?.read();
  controller.abort();
  reader?.releaseLock();
  const body = new TextDecoder().decode(chunk?.value);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  expect(body).toContain("event: ncp-event");
  expect(body).toContain("\"type\":\"context-window.updated\"");
  expect(body).toContain("\"usedContextTokens\":12");
});
