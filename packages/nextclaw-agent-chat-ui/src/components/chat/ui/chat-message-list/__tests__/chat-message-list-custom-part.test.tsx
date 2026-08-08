import { render, screen } from "@testing-library/react";
import type { ChatMessagePartViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const texts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

function createMessage(status: string) {
  return {
    id: "assistant-custom-process",
    role: "assistant" as const,
    roleLabel: "Assistant",
    timestampLabel: "10:00",
    status: "streaming",
    parts: [
      { type: "markdown" as const, text: "before marker" },
      {
        type: "custom" as const,
        id: "compaction-message-1",
        customType: "nextclaw.context-compaction",
        data: { status },
        process: true,
      },
      { type: "markdown" as const, text: "after marker" },
    ],
  };
}

const renderCustomPart = (
  part: Extract<ChatMessagePartViewModel, { type: "custom" }>,
) => (
  <span data-testid="custom-process-part">
    {(part.data as { status: string }).status}
  </span>
);

it("renders a custom process part in message order and preserves its DOM identity", () => {
  const view = render(
    <ChatMessageList
      messages={[createMessage("compressing")]}
      isSending
      hasAssistantDraft
      texts={texts}
      renderCustomPart={renderCustomPart}
    />,
  );
  const before = screen.getByText("before marker");
  const marker = screen.getByTestId("custom-process-part");
  const after = screen.getByText("after marker");
  expect(before.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(marker.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  view.rerender(
    <ChatMessageList
      messages={[createMessage("compressed")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={texts}
      renderCustomPart={renderCustomPart}
    />,
  );
  expect(screen.getByTestId("custom-process-part")).toBe(marker);
  expect(marker.textContent).toBe("compressed");
});
