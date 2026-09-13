import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";
import type { ChatMessageViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

const texts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

function createStreamingAssistant(
  id: string,
  text: string,
): ChatMessageViewModel {
  return {
    id,
    role: "assistant",
    roleLabel: "Assistant",
    timestampLabel: "10:00",
    status: "streaming",
    parts: [{ type: "markdown", text }],
  };
}

it("shows one active loading state when an earlier assistant remains streaming", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        createStreamingAssistant("assistant-stale", "Earlier tool activity"),
        createStreamingAssistant("assistant-active", "Current tool activity"),
      ]}
      isSending
      hasAssistantDraft
      texts={texts}
    />,
  );

  expect(container.querySelectorAll(".flex.space-x-1.items-center.h-full")).toHaveLength(1);
  expect(container.querySelector(
    '[data-chat-message-id="assistant-stale"] [data-stream-phase]',
  )).toBeNull();
  expect(container.querySelector(
    '[data-chat-message-id="assistant-active"] [data-stream-phase]',
  )).toBeTruthy();
});
