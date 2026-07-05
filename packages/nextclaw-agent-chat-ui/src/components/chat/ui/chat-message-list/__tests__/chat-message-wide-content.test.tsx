import { render, screen } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

it("lets messages containing wide inline content use the available message width", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-wide-inline",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:04",
          parts: [
            {
              type: "markdown",
              text:
                '```nextclaw-inline\n{"target":{"type":"panel_app","payload":{"appId":"weather-card"}},"title":"Weather"}\n```',
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
      renderInlineDisplay={(display) =>
        display.target.type === "panel_app" ? (
          <div data-chat-message-wide-content="true" data-testid="wide-inline-content" />
        ) : undefined
      }
    />,
  );

  const wideContent = screen.getByTestId("wide-inline-content");
  const wideAncestors = Array.from(container.querySelectorAll("div")).filter(
    (element) =>
      element.contains(wideContent) &&
      element.className.includes("has-[[data-chat-message-wide-content=true]]:w-full"),
  );

  expect(wideAncestors).toHaveLength(2);
});
