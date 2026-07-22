import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createApp() {
  const queuedInput = {
    id: "queued-1",
    sessionId: "session-1",
    enqueuedAt: "2026-07-22T10:00:00.000Z",
    metadata: { requested_skill_refs: ["project:review"] },
    message: {
      id: "message-1",
      sessionId: "session-1",
      role: "user" as const,
      status: "final" as const,
      timestamp: "2026-07-22T10:00:00.000Z",
      parts: [{ type: "text" as const, text: "queued" }],
    },
  };
  const listQueuedInputs = vi.fn((sessionId: string) =>
    sessionId === "session-1" ? [queuedInput] : [],
  );
  const removeQueuedInput = vi.fn((sessionId: string, queuedInputId: string) =>
    sessionId === "session-1" && queuedInputId === queuedInput.id ? queuedInput : null,
  );
  const configDir = mkdtempSync(join(tmpdir(), "nextclaw-session-queued-inputs-"));
  tempDirs.push(configDir);
  const configPath = join(configDir, "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  const app = createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({
      agentRunRequestManager: { listQueuedInputs, removeQueuedInput } as never,
      sessionManager: {
        getSession: async (sessionId: string) => sessionId === "missing" ? null : { sessionId },
      } as never,
    }),
  });
  return { app, listQueuedInputs, removeQueuedInput };
}

describe("NcpSessionRoutesController queued inputs", () => {
  it("lists the queue only through the requested session resource", async () => {
    const { app, listQueuedInputs } = createApp();

    const response = await app.request(
      "http://localhost/api/ncp/sessions/session-1/queued-inputs",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        sessionId: "session-1",
        inputs: [{
          id: "queued-1",
          sessionId: "session-1",
          metadata: { requested_skill_refs: ["project:review"] },
        }],
      },
    });
    expect(listQueuedInputs).toHaveBeenCalledWith("session-1");
  });

  it("returns 404 for a missing queue item or session", async () => {
    const { app, removeQueuedInput } = createApp();

    const missingItem = await app.request(
      "http://localhost/api/ncp/sessions/session-1/queued-inputs/missing",
      { method: "DELETE" },
    );
    const missingSession = await app.request(
      "http://localhost/api/ncp/sessions/missing/queued-inputs/queued-1",
      { method: "DELETE" },
    );

    expect(missingItem.status).toBe(404);
    expect(missingSession.status).toBe(404);
    expect(removeQueuedInput).toHaveBeenCalledTimes(1);
  });
});
