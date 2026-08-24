import { describe, expect, it } from "vitest";
import {
  buildChatMessageTriggerDetails,
  mergeChatMessageMoreActions,
} from "@/features/chat/features/message/utils/chat-message-trigger-details.utils";

const labels = {
  moreActions: "More actions",
  viewTrigger: "View trigger details",
  title: "Run trigger",
  description: "Why this run started.",
  close: "Close",
  notAvailable: "Not available",
  fields: {
    actor: "Actor",
    source: "Source",
    triggeredAt: "Triggered at",
    targetRunId: "Target run",
    sourceSessionId: "Source session",
    sourceMessageId: "Source message",
    sourceRunId: "Source run",
    sourceToolCallId: "Source tool call",
    sourceRequestId: "Source request",
    sourceModel: "Source model",
    targetModel: "Run model",
    sourceContext: "Source context",
    raw: "Raw metadata",
  },
  actors: {
    human: "Human",
    agent: "Agent",
    automation: "Automation",
    system: "System",
  },
};

describe("buildChatMessageTriggerDetails", () => {
  it("projects structured and raw provenance rows", () => {
    const details = buildChatMessageTriggerDetails({
      labels,
      message: {
        metadata: {
          run_trigger: {
            version: 1,
            actor: "agent",
            source: "sessions_spawn",
            triggeredAt: "2026-08-25T00:00:00.000Z",
            targetRunId: "target-run",
            sourceSessionId: "source-session",
            sourceMessageId: "source-message",
            sourceRunId: "source-run",
            sourceToolCallId: "source-tool-call",
            sourceRequestId: "source-request",
            sourceModel: "openai/gpt-5.6",
            sourceContext: { channel: "telegram", chatId: "chat-1" },
          },
          run_spec: {
            runId: "target-run",
            model: "minimax/MiniMax-M3",
          },
        },
      },
    });

    expect(details?.triggerLabel).toBe("More actions");
    expect(details?.items[0]?.dialog.rows).toEqual(expect.arrayContaining([
      { label: "Actor", value: "Agent" },
      { label: "Source model", value: "openai/gpt-5.6" },
      { label: "Run model", value: "minimax/MiniMax-M3" },
      { label: "Source context", value: expect.stringContaining("telegram") },
      expect.objectContaining({ label: "Raw metadata" }),
    ]));
    expect(details?.items[0]?.dialog.rows.find(
      (row) => row.label === "Raw metadata",
    )?.value).toContain("run_spec");
  });

  it("does not create an empty action for legacy messages", () => {
    expect(buildChatMessageTriggerDetails({ labels, message: {} })).toBeNull();
  });

  it("keeps trigger-only messages actionable and merges assistant details in order", () => {
    const triggerDetails = buildChatMessageTriggerDetails({
      labels,
      message: {
        metadata: {
          run_trigger: {
            version: 1,
            actor: "human",
            source: "ui-http",
            triggeredAt: "2026-08-25T00:00:00.000Z",
            targetRunId: "run-1",
          },
        },
      },
    });
    expect(mergeChatMessageMoreActions(null, triggerDetails)?.items.map(
      (item) => item.key,
    )).toEqual(["run-trigger-metadata"]);
    expect(mergeChatMessageMoreActions({
      triggerLabel: "More actions",
      items: [{
        key: "ai-execution-metadata",
        label: "View run metadata",
        dialog: { title: "Run", closeLabel: "Close", rows: [] },
      }],
    }, triggerDetails)?.items.map((item) => item.key)).toEqual([
      "ai-execution-metadata",
      "run-trigger-metadata",
    ]);
  });
});
