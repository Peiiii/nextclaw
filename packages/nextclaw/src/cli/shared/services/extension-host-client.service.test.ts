import { describe, expect, it, vi } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { ExtensionHostClient } from "./extension-host-client.service.js";

function createRuntimeParams() {
  return {
    sessionId: "session-1",
    agentId: "agent-1",
    sessionMetadata: { mode: "test" },
    setSessionMetadata: vi.fn(),
    resolveTools: vi.fn(() => [
      {
        type: "function",
        function: {
          name: "asset_export",
          description: "Export an asset",
          parameters: { type: "object", properties: {} },
        },
      },
    ]),
    stateManager: {
      dispatch: vi.fn(async () => undefined),
      dispatchBatch: vi.fn(async () => undefined),
      getSnapshot: vi.fn(() => ({ messages: [], streamingMessage: null, error: null, activeRun: null })),
      subscribe: vi.fn(() => () => undefined),
    },
  };
}

describe("ExtensionHostClient", () => {
  it("passes resolved tools to the child runtime request", async () => {
    const client = new ExtensionHostClient();
    const sentMessages: unknown[] = [];
    const runtimeParams = createRuntimeParams();
    const fakeChild = {
      send: vi.fn((message: unknown) => {
        sentMessages.push(message);
        const request = message as { type?: string; id?: number; method?: string };
        if (request.type === "request" && request.method === "runtime.run" && typeof request.id === "number") {
          (client as unknown as { handleMessage: (value: unknown) => void }).handleMessage({
            type: "response",
            id: request.id,
            ok: true,
          });
        }
        return true;
      }),
    };
    (client as unknown as { child: unknown }).child = fakeChild;
    (client as unknown as { ensureChild: () => unknown }).ensureChild = () => fakeChild;

    const stream = client.runRuntimeStream({
      kind: "codex",
      runtimeParams: runtimeParams as never,
      input: {
        sessionId: "session-1",
        messages: [],
      },
    });
    const nextPromise = stream.next();

    await vi.waitFor(() => {
      expect(runtimeParams.resolveTools).toHaveBeenCalledTimes(1);
      expect(fakeChild.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request",
          method: "runtime.run",
          payload: expect.objectContaining({
            runtimeParams: expect.objectContaining({
              resolvedTools: [
                expect.objectContaining({
                  function: expect.objectContaining({ name: "asset_export" }),
                }),
              ],
            }),
          }),
        }),
      );
    });

    (client as unknown as { handleMessage: (value: unknown) => void }).handleMessage({
      type: "event",
      event: "runtime.done",
      payload: { streamId: "runtime-1" },
    });
    await expect(nextPromise).resolves.toEqual({ done: true, value: undefined });
  });

  it("applies child runtime state batches to the parent state manager", async () => {
    const client = new ExtensionHostClient();
    const runtimeParams = createRuntimeParams();
    const fakeChild = {
      send: vi.fn((message: unknown) => {
        const request = message as { type?: string; id?: number; method?: string };
        if (request.type === "request" && request.method === "runtime.run" && typeof request.id === "number") {
          (client as unknown as { handleMessage: (value: unknown) => void }).handleMessage({
            type: "response",
            id: request.id,
            ok: true,
          });
        }
        return true;
      }),
    };
    (client as unknown as { child: unknown }).child = fakeChild;
    (client as unknown as { ensureChild: () => unknown }).ensureChild = () => fakeChild;

    const stream = client.runRuntimeStream({
      kind: "codex",
      runtimeParams: runtimeParams as never,
      input: {
        sessionId: "session-1",
        messages: [],
      },
    });
    const nextPromise = stream.next();

    await vi.waitFor(() => {
      expect(fakeChild.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "request", method: "runtime.run" }),
      );
    });

    (client as unknown as { handleMessage: (value: unknown) => void }).handleMessage({
      type: "event",
      event: "runtime.state.dispatchBatch",
      payload: {
        streamId: "runtime-1",
        events: [
          {
            type: NcpEventType.RunStarted,
            payload: {
              sessionId: "session-1",
              messageId: "message-1",
              runId: "run-1",
            },
          },
        ],
      },
    });

    await vi.waitFor(() => {
      expect(runtimeParams.stateManager.dispatchBatch).toHaveBeenCalledWith([
        {
          type: NcpEventType.RunStarted,
          payload: {
            sessionId: "session-1",
            messageId: "message-1",
            runId: "run-1",
          },
        },
      ]);
    });

    (client as unknown as { handleMessage: (value: unknown) => void }).handleMessage({
      type: "event",
      event: "runtime.done",
      payload: { streamId: "runtime-1" },
    });
    await expect(nextPromise).resolves.toEqual({ done: true, value: undefined });
  });
});
