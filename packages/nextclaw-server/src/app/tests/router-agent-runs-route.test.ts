import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import {
  EventBus,
  getKeyId,
  ingressKeys,
  type IngressEnvelope,
} from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

const tempDirs: string[] = [];
const originalHome = process.env.NEXTCLAW_HOME;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTestApp(calls: {
  abort: Array<{ sessionId: string }>;
  send: unknown[];
}): ReturnType<typeof createUiRouter> {
  process.env.NEXTCLAW_HOME = createTempDir("nextclaw-ui-agent-runs-home-");
  const configPath = join(createTempDir("nextclaw-ui-agent-runs-config-"), "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  return createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: {
      listSessionTypes: async () => ({ defaultType: "native", options: [] }),
      assetStore: {},
      eventBus: new EventBus(),
      ingress: {
        handle: async (envelope: IngressEnvelope) => {
          switch (getKeyId(envelope.type)) {
            case getKeyId(ingressKeys.agentRun.send):
              calls.send.push(envelope.payload);
              return {
                sessionId: "session-1",
                userMessageId: "user-message-1",
                assistantMessageId: null,
                runId: "run-1",
              };
            case getKeyId(ingressKeys.agentRun.abort):
              calls.abort.push(envelope.payload as { sessionId: string });
              return undefined;
            default:
              throw new Error(`Unsupported ingress type: ${getKeyId(envelope.type)}`);
          }
        },
      },
      llmProviders: {},
      sessionManager: {},
    } as unknown as UiKernelHost,
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

it("maps standard agent-runs send and abort routes to agent-run ingress", async () => {
  const calls = {
    abort: [] as Array<{ sessionId: string }>,
    send: [] as unknown[],
  };
  const app = createTestApp(calls);

  const sendResponse = await app.request("http://localhost/api/agent-runs/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      content: [{ type: "text", text: "hello from standard route" }],
      metadata: {
        agentId: "writer/default",
        projectRoot: "/tmp/project",
      },
    }),
  });
  expect(sendResponse.status).toBe(200);
  await expect(sendResponse.json()).resolves.toEqual({
    ok: true,
    data: {
      sessionId: "session-1",
      userMessageId: "user-message-1",
      assistantMessageId: null,
      runId: "run-1",
    },
  });
  expect(calls.send).toEqual([
    {
      content: [{ type: "text", text: "hello from standard route" }],
      metadata: {
        agentId: "writer/default",
        projectRoot: "/tmp/project",
      },
    },
  ]);

  const abortResponse = await app.request("http://localhost/api/agent-runs/abort", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId: "session-1",
    }),
  });
  expect(abortResponse.status).toBe(200);
  await expect(abortResponse.json()).resolves.toEqual({
    ok: true,
    data: { accepted: true },
  });
  expect(calls.abort).toEqual([{ sessionId: "session-1" }]);
});
