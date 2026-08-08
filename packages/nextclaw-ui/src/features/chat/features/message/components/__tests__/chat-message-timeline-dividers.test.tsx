import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatContextCompactionDivider } from "@/features/chat/features/message/components/chat-message-timeline-dividers";
import type { ContextCompactionTimelineView } from "@/features/chat/features/session/utils/ncp-session-context-metadata.utils";

vi.mock("@/shared/lib/i18n", () => ({
  t: (key: string) => key,
}));

function createCheckpoint(
  status: ContextCompactionTimelineView["status"],
): ContextCompactionTimelineView {
  return {
    id: `ctx-${status}`,
    status,
    summary: "Compressed earlier context",
    coveredMessageCount: 8,
    coveredSessionMessageCount: 8,
    originalEstimatedTokens: 30_000,
    projectedEstimatedTokens: 27_000,
    createdAt: "2026-08-08T11:59:50.000Z",
    updatedAt: "2026-08-08T12:00:00.000Z",
  };
}

describe("ChatContextCompactionDivider", () => {
  it("renders the active compaction state", () => {
    render(<ChatContextCompactionDivider checkpoint={createCheckpoint("compressing")} />);

    expect(screen.getByText("chatContextCompactionCompressing")).toBeTruthy();
  });

  it.each([
    ["compressed", "chatContextCompactionCompressed"],
    ["failed", "chatContextCompactionFailed"],
    ["cancelled", "chatContextCompactionCancelled"],
  ] as const)("renders %s as a terminal state", (status, expectedText) => {
    render(<ChatContextCompactionDivider checkpoint={createCheckpoint(status)} />);

    expect(screen.getByText(expectedText)).toBeTruthy();
    expect(screen.queryByText("chatContextCompactionCompressing")).toBeNull();
  });
});
