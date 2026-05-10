import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/kernel";
import {
  createNcpSessionRealtimeChangePublisher,
  toNcpSessionRealtimeEvent
} from "./ncp-session-realtime-change.utils.js";

describe("ncp-session-realtime-change", () => {
  it("converts upsert and delete changes into typed UI events", () => {
    expect(
      toNcpSessionRealtimeEvent({
        kind: "upsert",
        summary: {
          sessionId: "session-1",
          messageCount: 1,
          updatedAt: "2026-03-29T00:00:00.000Z",
          status: "running",
          metadata: {}
        }
      })
    ).toEqual({
      type: "session.summary.upsert",
      payload: {
        summary: {
          sessionId: "session-1",
          messageCount: 1,
          updatedAt: "2026-03-29T00:00:00.000Z",
          status: "running",
          metadata: {}
        }
      }
    });

    expect(
      toNcpSessionRealtimeEvent({
        kind: "delete",
        sessionKey: "session-1"
      })
    ).toEqual({
      type: "session.summary.delete",
      payload: {
        sessionKey: "session-1"
      }
    });
  });

  it("publishes an upsert when the session still exists and delete when it does not", async () => {
    const appEventBus = new EventBus();
    const emitEnvelope = vi.spyOn(appEventBus, "emitEnvelope");
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: "session-1",
        messageCount: 1,
        updatedAt: "2026-03-29T00:00:00.000Z",
        status: "idle",
        metadata: {}
      })
      .mockResolvedValueOnce(null);

    const publisher = createNcpSessionRealtimeChangePublisher({
      sessionApi: {
        getSession
      },
      appEventBus
    });

    await publisher.publishSessionChange("session-1");
    await publisher.publishSessionChange("session-1");

    expect(emitEnvelope).toHaveBeenNthCalledWith(1, {
      type: "session.summary.upsert",
      payload: {
        summary: {
          sessionId: "session-1",
          messageCount: 1,
          updatedAt: "2026-03-29T00:00:00.000Z",
          status: "idle",
          metadata: {}
        }
      }
    });
    expect(emitEnvelope).toHaveBeenNthCalledWith(2, {
      type: "session.summary.delete",
      payload: {
        sessionKey: "session-1"
      }
    });
  });
});
