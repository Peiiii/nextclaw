import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { SessionMessageCursorError } from "@nextclaw/kernel";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import { NcpSessionRoutesController } from "@nextclaw-server/features/sessions/controllers/sessions.controller.js";

function createMessagePageApp(listSessionMessagePage: (...args: unknown[]) => unknown) {
  const controller = new NcpSessionRoutesController({
    configPath: "/tmp/nextclaw-session-message-pagination-test.json",
    appEventBus: {
      emit: vi.fn(),
      subscribeAll: vi.fn()
    },
    kernel: {
      isSessionRunning: () => false,
      sessionManager: { listSessionMessagePage }
    }
  } as unknown as UiRouterOptions);
  const app = new Hono();
  app.get("/api/ncp/sessions/:sessionId/messages", controller.listSessionMessages);
  return app;
}

describe("NcpSessionRoutesController message pagination", () => {
  it("uses bounded cursor pages and returns their page metadata", async () => {
    const listSessionMessagePage = vi.fn(async () => ({
      messages: [{ id: "message-1" }],
      total: 1,
      pageInfo: { startCursor: "cursor-1", hasPreviousPage: false },
      contextWindow: null
    }));
    const app = createMessagePageApp(listSessionMessagePage);

    const initialResponse = await app.request("http://localhost/api/ncp/sessions/session-1/messages");
    const boundedResponse = await app.request("http://localhost/api/ncp/sessions/session-1/messages?limit=999&cursor=cursor-1");

    expect(initialResponse.status).toBe(200);
    await expect(initialResponse.json()).resolves.toMatchObject({
      ok: true,
      data: {
        total: 1,
        pageInfo: { startCursor: "cursor-1", hasPreviousPage: false }
      }
    });
    expect(boundedResponse.status).toBe(200);
    expect(listSessionMessagePage).toHaveBeenNthCalledWith(1, "session-1", { limit: 80 });
    expect(listSessionMessagePage).toHaveBeenNthCalledWith(2, "session-1", {
      limit: 200,
      cursor: "cursor-1"
    });
  });

  it("maps invalid cursors to a stable 400 error", async () => {
    const app = createMessagePageApp(
      vi.fn(async () => {
        throw new SessionMessageCursorError();
      })
    );

    const response = await app.request("http://localhost/api/ncp/sessions/session-1/messages?cursor=broken");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_CURSOR" }
    });
  });
});
