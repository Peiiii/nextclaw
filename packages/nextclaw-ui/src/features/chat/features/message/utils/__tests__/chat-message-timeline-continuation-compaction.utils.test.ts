import { describe, expect, it } from "vitest";
import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  type NcpMessage,
} from "@nextclaw/ncp";
import { CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY } from "@nextclaw/shared";
import {
  buildChatMessageTimelineItems,
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

function createContinuationPrompt(id: string, targetId: string): NcpMessage {
  return {
    ...visibleMessage,
    id,
    role: "user",
    parts: [],
    metadata: {
      [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
      [CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY]: targetId,
    },
  };
}

function createCompactionMessage(params: {
  assistantId?: string;
  coveredPartCount?: number;
  id: string;
  phase: "pre-run" | "mid-run";
  status?: "compressing" | "compressed";
}): NcpMessage {
  const {
    assistantId,
    coveredPartCount,
    id,
    phase,
    status = "compressed",
  } = params;
  return {
    ...visibleMessage,
    id,
    role: "service",
    parts: [],
    metadata: {
      nextclaw_timeline_kind: "context_compaction",
      checkpoint: {
        id: `checkpoint-${id}`,
        status,
        phase,
        continuationMessageId: assistantId,
        continuationMessageCoveredPartCount: coveredPartCount,
        summary: status === "compressing" ? "" : "Compressed context",
        coveredMessageCount: 1,
        coveredSessionMessageCount: 1,
        originalEstimatedTokens: 34_000,
        projectedEstimatedTokens: 26_000,
        createdAt: "2026-08-07T00:00:50.000Z",
        updatedAt: "2026-08-07T00:01:00.000Z",
      },
    },
  };
}

describe("continuation compaction timeline projection", () => {
  it("keeps legacy pre-run compaction inline before its assistant exists", () => {
    const continuationPrompt = createContinuationPrompt(
      "continue-pending",
      visibleMessage.id,
    );
    const preRun = createCompactionMessage({
      id: "context-compaction-pre-run-pending",
      phase: "pre-run",
      status: "compressing",
    });
    const rawMessages = [visibleMessage, continuationPrompt, preRun];

    expect(projectVisibleChatMessages(rawMessages)[0]?.parts.map((part) =>
      part.type === "extension" ? (part.data as { id: string }).id : part.type,
    )).toEqual(["text", preRun.id]);
    expect(buildChatMessageTimelineItems({
      rawMessages,
      messages: [{ id: visibleMessage.id } as never],
    }).map((item) => item.kind)).toEqual(["message"]);
  });

  it("preserves explicit pre-run and mid-run boundaries across continuations", () => {
    const firstAssistant: NcpMessage = {
      ...visibleMessage,
      id: "assistant-continuation-1",
      parts: [
        { type: "text", text: "continued-1" },
        { type: "text", text: "continued-2" },
      ],
    };
    const secondAssistant: NcpMessage = {
      ...visibleMessage,
      id: "assistant-continuation-2",
      parts: [{ type: "text", text: "continued-3" }],
    };
    const firstPreRun = createCompactionMessage({
      assistantId: visibleMessage.id,
      coveredPartCount: visibleMessage.parts.length,
      id: "pre-run-1",
      phase: "pre-run",
    });
    const secondPreRun = createCompactionMessage({
      assistantId: firstAssistant.id,
      coveredPartCount: firstAssistant.parts.length,
      id: "pre-run-2",
      phase: "pre-run",
    });
    const firstMidRun = createCompactionMessage({
      assistantId: firstAssistant.id,
      coveredPartCount: 1,
      id: "mid-run-1",
      phase: "mid-run",
    });
    const secondMidRun = createCompactionMessage({
      assistantId: secondAssistant.id,
      coveredPartCount: 1,
      id: "mid-run-2",
      phase: "mid-run",
    });
    const rawMessages = [
      visibleMessage,
      createContinuationPrompt("continue-1", visibleMessage.id),
      firstPreRun,
      firstAssistant,
      firstMidRun,
      createContinuationPrompt("continue-2", firstAssistant.id),
      secondPreRun,
      secondAssistant,
      secondMidRun,
    ];

    const [projectedMessage] = projectVisibleChatMessages(rawMessages);
    expect(projectedMessage?.parts.map((part) =>
      part.type === "extension"
        ? (part.data as { id: string }).id
        : part.type === "text"
          ? part.text
          : part.type,
    )).toEqual([
      "visible",
      firstPreRun.id,
      "continued-1",
      firstMidRun.id,
      "continued-2",
      secondPreRun.id,
      "continued-3",
      secondMidRun.id,
    ]);
    expect(buildChatMessageTimelineItems({
      rawMessages,
      messages: [{ id: visibleMessage.id } as never],
    }).map((item) => item.kind)).toEqual(["message"]);
  });
});
