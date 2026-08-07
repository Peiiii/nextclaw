import { describe, expect, it } from "vitest";
import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  NcpEventType,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";
import { createSessionActivityPreviewFromNcpEvent } from "./session-activity-preview-ncp-event.utils.js";

const TIMESTAMP = "2026-05-16T01:00:00.000Z";

describe("createSessionActivityPreviewFromNcpEvent", () => {
  it("projects run start into a running status preview", () => {
    expect(
      createSessionActivityPreviewFromNcpEvent({
        type: NcpEventType.RunStarted,
        payload: { sessionId: "session-1" },
      }, TIMESTAMP),
    ).toEqual({
      sessionId: "session-1",
      preview: {
        state: "running",
        statusKind: "thinking",
        timestamp: TIMESTAMP,
      },
    });
  });

  it("projects tool completion with the remembered tool name", () => {
    expect(
      createSessionActivityPreviewFromNcpEvent({
        type: NcpEventType.MessageToolCallResult,
        payload: {
          sessionId: "session-1",
          toolCallId: "tool-call-1",
          content: "ok",
        },
      }, TIMESTAMP, {
        readToolName: (_sessionId, toolCallId) => toolCallId === "tool-call-1" ? "read_file" : null,
      }),
    ).toEqual({
      sessionId: "session-1",
      preview: {
        state: "running",
        statusKind: "tool-completed",
        statusText: "read_file",
        timestamp: TIMESTAMP,
      },
    });
  });

  it("projects assistant completion with the completion event timestamp", () => {
    expect(
      createSessionActivityPreviewFromNcpEvent({
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId: "session-1",
          message: {
            id: "message-1",
            sessionId: "session-1",
            role: "assistant",
            status: "final",
            timestamp: "2026-05-16T01:01:00.000Z",
            parts: [{ type: "text", text: "  已经整理好方案\n\n下一步可以实现  " }],
          },
        },
      }, TIMESTAMP),
    ).toEqual({
      sessionId: "session-1",
      preview: {
        state: "completed",
        replyText: "已经整理好方案 下一步可以实现",
        timestamp: TIMESTAMP,
      },
    });
  });

  it("preserves complete provider errors without compacting or truncating them", () => {
    const providerError = `Chat Completions API failed (402): {\n  "error": "${"x".repeat(180)} END_OF_PROVIDER_ERROR"\n}`;

    expect(
      createSessionActivityPreviewFromNcpEvent({
        type: NcpEventType.RunError,
        payload: {
          sessionId: "session-1",
          error: providerError,
        },
      }, TIMESTAMP),
    ).toEqual({
      sessionId: "session-1",
      preview: {
        state: "failed",
        statusKind: "run-failed",
        statusText: providerError,
        timestamp: TIMESTAMP,
      },
    });

    expect(
      createSessionActivityPreviewFromNcpEvent({
        type: NcpEventType.MessageFailed,
        payload: {
          sessionId: "session-1",
          error: {
            code: "runtime-error",
            message: providerError,
          },
        },
      }, TIMESTAMP),
    ).toMatchObject({
      preview: {
        statusText: providerError,
      },
    });
  });

  it("projects user message aborts into metadata-only cancelled previews", () => {
    expect(
      createSessionActivityPreviewFromNcpEvent({
        type: NcpEventType.MessageAbort,
        payload: {
          sessionId: "session-1",
          messageId: "assistant-1",
          runId: "run-1",
          reason: {
            code: "abort-error",
            message: "User stopped the current run.",
          },
        },
      }, TIMESTAMP),
    ).toEqual({
      sessionId: "session-1",
      preview: {
        state: "cancelled",
        timestamp: TIMESTAMP,
      },
    });
  });

  it("ignores streaming delta events", () => {
    const event: NcpEndpointEvent = {
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        delta: "hello",
      },
    };

    expect(createSessionActivityPreviewFromNcpEvent(event, TIMESTAMP)).toBeNull();
  });

  it("ignores hidden continuation prompts so they never replace the user-facing preview", () => {
    expect(createSessionActivityPreviewFromNcpEvent({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: {
          id: "continue-1",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: TIMESTAMP,
          parts: [{ type: "text", text: "internal continuation prompt" }],
          metadata: {
            [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
          },
        },
      },
    }, TIMESTAMP)).toBeNull();
  });
});
