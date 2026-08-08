import { describe, expect, it } from "vitest";
import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  type NcpMessage,
} from "@nextclaw/ncp";
import { CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY } from "@nextclaw/shared";
import {
  buildChatMessageTimelineItems,
  isVisibleChatMessage,
  projectVisibleChatMessages,
} from "@/features/chat/features/message/utils/chat-message-timeline.utils";

const visibleMessage = {
  id: "assistant-visible",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  timestamp: "2026-08-07T00:00:00.000Z",
  parts: [{ type: "text", text: "visible" }],
} satisfies NcpMessage;

describe("chat message timeline visibility", () => {
  it("places context compaction between surrounding visible messages", () => {
    const afterMessage = {
      ...visibleMessage,
      id: "assistant-after",
      timestamp: "2026-08-07T00:02:00.000Z",
    };
    const compactionMessage = {
      ...visibleMessage,
      id: "context-compaction-1",
      role: "service" as const,
      timestamp: "2026-08-07T00:01:00.000Z",
      metadata: {
        nextclaw_timeline_kind: "context_compaction",
        checkpoint: {
          id: "ctx-1",
          status: "compressed",
          summary: "Compressed earlier context",
          coveredMessageCount: 8,
          coveredSessionMessageCount: 8,
          originalEstimatedTokens: 76_000,
          projectedEstimatedTokens: 51_000,
          createdAt: "2026-08-07T00:00:50.000Z",
          updatedAt: "2026-08-07T00:01:00.000Z",
        },
      },
    } satisfies NcpMessage;

    const items = buildChatMessageTimelineItems({
      rawMessages: [visibleMessage, compactionMessage, afterMessage],
      messages: [
        { id: visibleMessage.id } as never,
        { id: afterMessage.id } as never,
      ],
    });

    expect(items.map((item) => item.kind)).toEqual([
      "message",
      "compaction",
      "message",
    ]);
  });

  it("hides internal and legacy silent messages", () => {
    expect(isVisibleChatMessage({
      ...visibleMessage,
      metadata: { [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden" },
    })).toBe(false);
    expect(isVisibleChatMessage({
      ...visibleMessage,
      parts: [{ type: "text", text: "\\n\\n<noreply/>" }],
    })).toBe(false);
    expect(isVisibleChatMessage(visibleMessage)).toBe(true);
  });

  it("projects continued assistant output into the interrupted message", () => {
    const messages = projectVisibleChatMessages([
      {
        ...visibleMessage,
        lifecycle: { startedAt: "2026-08-07T00:00:01.000Z" },
        parts: [{ type: "text", text: "half" }],
        status: "error",
      },
      {
        id: "continue-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        timestamp: "2026-08-07T00:01:00.000Z",
        parts: [{ type: "text", text: "continue" }],
        metadata: {
          [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
          [CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY]: "assistant-visible",
        },
      },
      {
        ...visibleMessage,
        id: "assistant-continuation",
        lifecycle: { endedAt: "2026-08-07T00:02:00.000Z" },
        parts: [{ type: "text", text: " done" }],
        timestamp: "2026-08-07T00:01:01.000Z",
      },
    ]);

    expect(messages).toEqual([
      expect.objectContaining({
        id: "assistant-visible",
        status: "final",
        parts: [
          { type: "text", text: "half" },
          { type: "text", text: " done" },
        ],
        lifecycle: {
          startedAt: "2026-08-07T00:00:01.000Z",
          endedAt: "2026-08-07T00:02:00.000Z",
        },
      }),
    ]);
  });

  it("keeps repeated continuations in one canonical assistant message", () => {
    const continuationPrompt = (id: string, targetId: string): NcpMessage => ({
      id,
      sessionId: "session-1",
      role: "user",
      status: "final",
      timestamp: "2026-08-07T00:01:00.000Z",
      parts: [{ type: "text", text: "continue" }],
      metadata: {
        [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
        [CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY]: targetId,
      },
    });
    const messages = projectVisibleChatMessages([
      { ...visibleMessage, parts: [{ type: "text", text: "one" }] },
      continuationPrompt("continue-1", "assistant-visible"),
      { ...visibleMessage, id: "assistant-2", parts: [{ type: "text", text: " two" }] },
      continuationPrompt("continue-2", "assistant-2"),
      { ...visibleMessage, id: "assistant-3", parts: [{ type: "text", text: " three" }] },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "assistant-visible",
      parts: [
        { type: "text", text: "one" },
        { type: "text", text: " two" },
        { type: "text", text: " three" },
      ],
    });
  });

  it("marks the interrupted message pending before continuation output arrives", () => {
    const messages = projectVisibleChatMessages([
      visibleMessage,
      {
        id: "continue-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        timestamp: "2026-08-07T00:01:00.000Z",
        parts: [],
        metadata: {
          [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
          [CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY]: "assistant-visible",
        },
      },
    ], { continuationRunning: true });

    expect(messages).toEqual([
      expect.objectContaining({ id: "assistant-visible", status: "pending" }),
    ]);
  });

  it("never merges unrelated adjacent assistant messages", () => {
    expect(projectVisibleChatMessages([
      visibleMessage,
      { ...visibleMessage, id: "assistant-unrelated" },
    ]).map((message) => message.id)).toEqual([
      "assistant-visible",
      "assistant-unrelated",
    ]);
  });

  it("rejects a malformed continuation target that is not an assistant", () => {
    const userMessage = { ...visibleMessage, id: "user-1", role: "user" as const };
    const hiddenPrompt = {
      ...userMessage,
      id: "continue-1",
      metadata: {
        [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
        [CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY]: "user-1",
      },
    };

    expect(projectVisibleChatMessages([
      userMessage,
      hiddenPrompt,
      { ...visibleMessage, id: "assistant-1" },
    ]).map((message) => message.id)).toEqual(["user-1", "assistant-1"]);
  });
});
