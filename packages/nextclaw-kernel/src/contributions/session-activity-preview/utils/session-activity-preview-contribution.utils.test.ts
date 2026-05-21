import { describe, expect, it, vi } from "vitest";
import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { SessionActivityPreviewContribution } from "@kernel/contributions/session-activity-preview/index.js";
import { NcpEventType } from "@nextclaw/ncp";
import { EventBus, eventKeys } from "@nextclaw/shared";
import { SESSION_ACTIVITY_PREVIEW_METADATA_KEY } from "./session-activity-preview-metadata.utils.js";

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function createKernelStub(initialMetadata: Record<string, unknown>) {
  const eventBus = new EventBus();
  let metadata = structuredClone(initialMetadata);
  const getSession = vi.fn(async () => ({
    sessionId: "session-1",
    messageCount: 2,
    updatedAt: "2026-05-21T00:00:00.000Z",
    status: "idle",
    metadata: structuredClone(metadata),
  }));
  const updateSession = vi.fn(async (_sessionId: string, patch: { metadata?: Record<string, unknown> | null }) => {
    metadata = structuredClone(patch.metadata ?? {});
    return {
      sessionId: "session-1",
      messageCount: 2,
      updatedAt: "2026-05-21T00:00:01.000Z",
      status: "idle",
      metadata: structuredClone(metadata),
    };
  });

  return {
    eventBus,
    getMetadata: () => metadata,
    updateSession,
    kernel: {
      eventBus,
      ncpSessionApi: {
        getSession,
        updateSession,
      },
    } as unknown as NextclawKernel,
  };
}

describe("SessionActivityPreviewContribution", () => {
  it("serializes session preview writes so run.finished cannot overwrite completed reply text", async () => {
    const { eventBus, getMetadata, kernel, updateSession } = createKernelStub({
      [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
        state: "running",
        statusText: "正在处理...",
        timestamp: "2026-05-21T00:00:00.000Z",
      },
    });
    const contribution = new SessionActivityPreviewContribution(kernel);
    contribution.start();

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: {
          id: "assistant-1",
          sessionId: "session-1",
          role: "assistant",
          status: "final",
          timestamp: "2026-05-21T00:00:01.000Z",
          parts: [{ type: "text", text: "final preview text" }],
        },
      },
    });
    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
      },
    });

    await flushPromises();

    expect(updateSession).toHaveBeenCalledTimes(2);
    expect(getMetadata()[SESSION_ACTIVITY_PREVIEW_METADATA_KEY]).toMatchObject({
      state: "completed",
      replyText: "final preview text",
    });
    contribution.dispose();
  });
});
