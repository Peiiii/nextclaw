import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { SessionMessageCursorError } from "@nextclaw/kernel";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import { NcpSessionRoutesController } from "@nextclaw-server/features/sessions/controllers/sessions.controller.js";

function createMessagePageApp(listSessionMessagePage: (...args: unknown[]) => unknown, sourceMethods: Record<string, unknown> = {}) {
  const controller = new NcpSessionRoutesController({
    configPath: "/tmp/nextclaw-session-message-pagination-test.json",
    appEventBus: {
      emit: vi.fn(),
      subscribeAll: vi.fn()
    },
    kernel: {
      isSessionRunning: () => false,
      sessionManager: { listSessionMessagePage, ...sourceMethods }
    }
  } as unknown as UiRouterOptions);
  const app = new Hono();
  app.get("/api/ncp/sessions/:sessionId/messages", controller.listSessionMessages);
  app.get("/api/ncp/sessions/:sessionId/messages/:messageId/parts/:part", controller.readSessionMessagePart);
  return app;
}

describe("NcpSessionRoutesController message pagination", () => {
  it("returns visible preparation instead of waiting on source repair, then accepts bounded long source cursors", async () => {
    const prepareSessionHistory = vi.fn(async () => ({ status: "preparing" }));
    const readSessionMessagePart = vi.fn(async () => ({ content: "fragment", nextCursor: null }));
    const app = createMessagePageApp(vi.fn(), { prepareSessionHistory, readSessionMessagePart });
    const path = "http://localhost/api/ncp/sessions/s/messages/m/parts/0";
    expect((await app.request(path)).status).toBe(409);
    expect(readSessionMessagePart).not.toHaveBeenCalled();
    prepareSessionHistory.mockResolvedValue({ status: "ready" });
    expect((await app.request(path + "?cursor=" + "x".repeat(4096))).status).toBe(200);
    readSessionMessagePart.mockRejectedValueOnce(new SessionMessageCursorError());
    expect((await app.request(path + "?cursor=stale")).status).toBe(400);
    expect((await app.request(path + "?cursor=" + "x".repeat(32769))).status).toBe(400);
    expect((await app.request(path.replace("parts/0", "parts/-1"))).status).toBe(400);
    const literalId = "m%2F汉字";
    expect((await app.request(path.replace("/m/parts", `/${encodeURIComponent(literalId)}/parts`))).status).toBe(200);
    expect(readSessionMessagePart).toHaveBeenLastCalledWith({ sessionId: "s", messageId: literalId, part: 0, cursor: undefined });
  });
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
    expect(listSessionMessagePage).toHaveBeenNthCalledWith(1, "session-1", { limit: 40 });
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

  it("only defers large tool payloads when the UI opts into summary mode", async () => {
    const message = {
      id: "assistant-large",
      sessionId: "session-1",
      role: "assistant",
      status: "final",
      timestamp: "2026-08-19T00:00:00.000Z",
      parts: [{
        type: "tool-invocation",
        toolCallId: "tool-1",
        toolName: "exec_command",
        state: "result",
        args: { command: "pnpm test", payload: "x".repeat(300_000) },
        result: { output: "x".repeat(300_000) },
      }],
    };
    const app = createMessagePageApp(vi.fn(async () => ({
      messages: [message],
      messageDetailCursors: { "assistant-large": "cursor-detail" },
      total: 1,
      pageInfo: { startCursor: "cursor-1", hasPreviousPage: false },
      contextWindow: null,
    })));

    const summary = await app.request(
      "http://localhost/api/ncp/sessions/session-1/messages?toolPayload=summary",
    );
    const full = await app.request(
      "http://localhost/api/ncp/sessions/session-1/messages",
    );
    await expect(summary.json()).resolves.toMatchObject({
      data: {
        messages: [{
          metadata: {
            nextclawUiHistoryToolPayloadSummary: {
              toolCallCount: 1,
              toolNames: ["exec_command"],
            },
          },
          parts: [{ type: "tool-invocation" }],
        }],
        deferredToolPayloads: { "assistant-large": { cursor: "cursor-detail" } },
      },
    });
    await expect(full.json()).resolves.toMatchObject({
      data: {
        messages: [{ parts: [{ result: { output: expect.any(String) } }] }],
      },
    });
  });

  it("compacts only the initial summary page and preserves a cursor to omitted messages", async () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      id: `message-${index}`,
      sessionId: "session-1",
      role: "assistant" as const,
      status: "final" as const,
      timestamp: "2026-08-20T00:00:00.000Z",
      parts: [{ type: "text" as const, text: "x".repeat(10_000) }],
    }));
    const app = createMessagePageApp(vi.fn(async () => ({
      messages,
      messageDetailCursors: Object.fromEntries(
        messages.map((message, index) => [message.id, `cursor-after-${index}`]),
      ),
      total: messages.length,
      pageInfo: { startCursor: "cursor-start", hasPreviousPage: false },
      contextWindow: null,
    })));

    const response = await app.request(
      "http://localhost/api/ncp/sessions/session-1/messages?limit=20&toolPayload=summary&initialPayload=compact",
    );
    const payload = await response.json();

    expect(payload).toMatchObject({
      data: {
        messages: messages.slice(6),
        total: 8,
        pageInfo: {
          startCursor: "cursor-after-5",
          hasPreviousPage: true,
        },
      },
    });
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(24 * 1024);
  });
});
