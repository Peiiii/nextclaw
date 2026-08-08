import { describe, expect, it } from "vitest";
import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  type NcpMessage,
} from "@nextclaw/ncp";
import { CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY } from "@nextclaw/shared";
import {
  buildChatMessageTimelineItems,
  CONTEXT_COMPACTION_PART_EXTENSION_TYPE,
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

function createCompactionMessage(params: {
  assistantId: string;
  coveredPartCount: number;
  id: string;
  status?: "compressing" | "compressed";
  summary?: string;
}): NcpMessage {
  const { assistantId, coveredPartCount, id, status, summary } = params;
  return {
    ...visibleMessage,
    id,
    role: "service",
    parts: [],
    metadata: {
      nextclaw_timeline_kind: "context_compaction",
      checkpoint: {
        id: `checkpoint-${id}`,
        status: status ?? "compressed",
        phase: "mid-run",
        continuationMessageId: assistantId,
        continuationMessageCoveredPartCount: coveredPartCount,
        summary: summary ?? "Compressed context",
        coveredMessageCount: coveredPartCount,
        coveredSessionMessageCount: coveredPartCount,
        originalEstimatedTokens: 34_000,
        projectedEstimatedTokens: 26_000,
        createdAt: "2026-08-07T00:00:50.000Z",
        updatedAt: "2026-08-07T00:01:00.000Z",
      },
    },
  };
}

describe("mid-run compaction timeline projection", () => {
  it("projects an empty-summary compressing marker inside the active assistant boundary", () => {
    const activeAssistant = {
      ...visibleMessage,
      status: "streaming" as const,
      parts: [
        { type: "text" as const, text: "before" },
        { type: "reasoning" as const, text: "covered reasoning" },
        { type: "text" as const, text: "after" },
      ],
    };
    const compactionMessage = createCompactionMessage({
      assistantId: activeAssistant.id,
      coveredPartCount: 2,
      id: "context-compaction-mid-run",
      status: "compressing",
      summary: "",
    });

    const projected = projectVisibleChatMessages([activeAssistant, compactionMessage]);
    expect(projected).toHaveLength(1);
    expect(projected[0]?.parts.map((part) => part.type)).toEqual([
      "text",
      "reasoning",
      "extension",
      "text",
    ]);
    expect(projected[0]?.parts[2]).toMatchObject({
      type: "extension",
      extensionType: CONTEXT_COMPACTION_PART_EXTENSION_TYPE,
      data: { id: compactionMessage.id },
    });
    expect(buildChatMessageTimelineItems({
      rawMessages: [activeAssistant, compactionMessage],
      messages: [{ id: activeAssistant.id } as never],
    }).map((item) => item.kind)).toEqual(["message"]);
  });

  it("keeps repeated compactions ordered inside one assistant message", () => {
    const activeAssistant = {
      ...visibleMessage,
      status: "streaming" as const,
      parts: ["one", "two", "three", "four"].map((text) => ({
        type: "text" as const,
        text,
      })),
    };
    const first = createCompactionMessage({
      assistantId: activeAssistant.id,
      coveredPartCount: 1,
      id: "context-compaction-1",
    });
    const second = createCompactionMessage({
      assistantId: activeAssistant.id,
      coveredPartCount: 3,
      id: "context-compaction-2",
    });

    const [projectedMessage] = projectVisibleChatMessages([
      activeAssistant,
      first,
      second,
    ]);
    expect(projectedMessage?.parts.map((part) =>
      part.type === "extension"
        ? (part.data as { id: string }).id
        : part.type === "text"
          ? part.text
          : part.type,
    )).toEqual([
      "one",
      first.id,
      "two",
      "three",
      second.id,
      "four",
    ]);
  });

  it("does not silently clamp an invalid canonical part boundary", () => {
    const invalidCompaction = createCompactionMessage({
      assistantId: visibleMessage.id,
      coveredPartCount: 2,
      id: "context-compaction-invalid-boundary",
    });

    expect(projectVisibleChatMessages([
      visibleMessage,
      invalidCompaction,
    ])[0]?.parts).toEqual(visibleMessage.parts);
    expect(buildChatMessageTimelineItems({
      rawMessages: [visibleMessage, invalidCompaction],
      messages: [{ id: visibleMessage.id } as never],
    }).map((item) => item.kind)).toEqual(["message", "compaction"]);
  });

  it("offsets a continued assistant compaction within its canonical message", () => {
    const continuationPrompt: NcpMessage = {
      ...visibleMessage,
      id: "continue-1",
      role: "user",
      parts: [],
      metadata: {
        [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
        [CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY]: visibleMessage.id,
      },
    };
    const continuationAssistant: NcpMessage = {
      ...visibleMessage,
      id: "assistant-continuation",
      parts: [
        { type: "text", text: "continued-1" },
        { type: "text", text: "continued-2" },
        { type: "text", text: "continued-3" },
      ],
    };
    const compactionMessage = createCompactionMessage({
      assistantId: continuationAssistant.id,
      coveredPartCount: 2,
      id: "context-compaction-continuation",
    });

    const [projectedMessage] = projectVisibleChatMessages([
      visibleMessage,
      continuationPrompt,
      continuationAssistant,
      compactionMessage,
    ]);
    expect(projectedMessage?.parts.map((part) =>
      part.type === "text" ? part.text : part.type,
    )).toEqual([
      "visible",
      "continued-1",
      "continued-2",
      "extension",
      "continued-3",
    ]);
  });

});
