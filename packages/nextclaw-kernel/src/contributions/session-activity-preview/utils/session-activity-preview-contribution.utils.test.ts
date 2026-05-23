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
  const updateSession = vi.fn();
  const patchSessionMetadata = vi.fn(async (
    _sessionId: string,
    patcher: (current: Record<string, unknown>) => Record<string, unknown> | null,
  ) => {
    const nextMetadata = patcher(structuredClone(metadata));
    if (!nextMetadata) {
      return false;
    }
    metadata = structuredClone(nextMetadata);
    return true;
  });

  return {
    eventBus,
    getMetadata: () => metadata,
    patchSessionMetadata,
    updateSession,
    kernel: {
      eventBus,
      ncpSessionManager: {
        patchSessionMetadata,
      },
    } as unknown as NextclawKernel,
  };
}

describe("SessionActivityPreviewContribution", () => {
  it("routes preview writes through the ncp session manager instead of updating the store directly", async () => {
    const { eventBus, getMetadata, kernel, patchSessionMetadata, updateSession } = createKernelStub({
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

    expect(patchSessionMetadata).toHaveBeenCalledTimes(2);
    expect(updateSession).not.toHaveBeenCalled();
    expect(getMetadata()[SESSION_ACTIVITY_PREVIEW_METADATA_KEY]).toMatchObject({
      state: "completed",
      replyText: "final preview text",
    });
    contribution.dispose();
  });
});
