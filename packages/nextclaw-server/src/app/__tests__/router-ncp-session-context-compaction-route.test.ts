import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { SessionContextCompactionError } from "@nextclaw/kernel";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const tempDirs: string[] = [];

function createConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-context-compaction-route-"));
  tempDirs.push(dir);
  const configPath = join(dir, "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  return configPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function createApp(compact: (sessionId: string) => Promise<unknown>) {
  return createUiRouter({
    appEventBus: new EventBus(),
    configPath: createConfigPath(),
    kernel: createRouterTestKernel({
      sessionContextCompactionManager: { compact } as never,
    }),
  });
}

describe("POST /api/ncp/sessions/:sessionId/context/compact", () => {
  it("returns the assembled success envelope", async () => {
    const app = createApp(async (sessionId) => ({ compacted: true, sessionId }));

    const response = await app.request(
      "http://localhost/api/ncp/sessions/session%201/context/compact",
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { compacted: true, sessionId: "session 1" },
    });
  });

  it.each([
    ["SESSION_NOT_FOUND", 404],
    ["SESSION_BUSY", 409],
    ["CONTEXT_COMPACTION_UNSUPPORTED", 409],
    ["NOTHING_TO_COMPACT", 409],
  ] as const)("maps %s without returning a false success", async (code, status) => {
    const app = createApp(async () => {
      throw new SessionContextCompactionError(code, `failed: ${code}`);
    });

    const response = await app.request(
      "http://localhost/api/ncp/sessions/session-1/context/compact",
      { method: "POST" },
    );
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(status);
    expect(payload).toMatchObject({
      ok: false,
      error: { code, message: `failed: ${code}` },
    });
    expect(payload).not.toHaveProperty("data");
  });
});
