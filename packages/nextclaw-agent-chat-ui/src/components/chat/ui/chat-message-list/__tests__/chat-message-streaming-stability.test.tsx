import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";
import type {
  ChatInlineTokenViewModel,
  ChatMessageTexts,
  ChatMessageViewModel,
  ChatPanelAppCardViewModel,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

const texts: ChatMessageTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

function renderMessages(
  messages: ChatMessageViewModel[],
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode,
  onInlineTokenClick?: (token: ChatInlineTokenViewModel) => void,
) {
  return (
    <ChatMessageList
      messages={messages}
      isSending
      hasAssistantDraft
      texts={texts}
      renderPanelAppCard={renderPanelAppCard}
      onInlineTokenClick={onInlineTokenClick}
    />
  );
}

function createPanelAppRenderer() {
  return () => <iframe title="Panel app" />;
}

function selectText(node: Node): Selection {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  if (!selection) {
    throw new Error("Selection API unavailable");
  }
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

it("preserves a historical user message DOM node and selection while the assistant streams", () => {
  const firstInlineTokenClick = vi.fn();
  const secondInlineTokenClick = vi.fn();
  const userMessage: ChatMessageViewModel = {
    id: "user-1",
    role: "user",
    roleLabel: "You",
    timestampLabel: "10:00",
    status: "final",
    parts: [{ type: "markdown", text: "Keep this selected" }],
  };
  const firstAssistantMessage: ChatMessageViewModel = {
    id: "assistant-1",
    role: "assistant",
    roleLabel: "Assistant",
    timestampLabel: "10:01",
    status: "streaming",
    parts: [{ type: "reasoning", label: "Reasoning", text: "First" }],
  };
  const view = render(
    renderMessages(
      [userMessage, firstAssistantMessage],
      createPanelAppRenderer(),
      firstInlineTokenClick,
    ),
  );
  const selectedText = screen.getByText("Keep this selected").firstChild;
  if (!selectedText) {
    throw new Error("Expected historical message text node");
  }
  const selection = selectText(selectedText);

  view.rerender(
    renderMessages(
      [
        userMessage,
        {
          ...firstAssistantMessage,
          parts: [
            {
              type: "reasoning",
              label: "Reasoning",
              text: "First streamed update",
            },
          ],
        },
      ],
      createPanelAppRenderer(),
      secondInlineTokenClick,
    ),
  );

  expect(screen.getByText("Keep this selected").firstChild).toBe(selectedText);
  expect(selection.toString()).toBe("Keep this selected");
});

it("preserves an inline panel app when later process parts arrive", () => {
  const panelApp: ChatPanelAppCardViewModel = {
    appId: "piano",
    title: "Piano",
    action: {
      kind: "show-content",
      label: "Piano",
      request: {
        target: { type: "panel_app", payload: { appId: "piano" } },
        placement: "side_panel",
      },
    },
  };
  const panelPart = {
    type: "tool-card" as const,
    card: {
      kind: "result" as const,
      toolName: "show_panel_app",
      hasResult: true,
      statusTone: "success" as const,
      statusLabel: "Completed",
      titleLabel: "Tool result",
      outputLabel: "Output",
      emptyLabel: "No output",
      panelApp,
    },
  };
  const message: ChatMessageViewModel = {
    id: "assistant-panel",
    role: "assistant",
    roleLabel: "Assistant",
    timestampLabel: "10:01",
    status: "streaming",
    parts: [panelPart],
  };
  const renderPanelAppCard = () => (
    <iframe data-testid="inline-panel-app" title="Piano" />
  );
  const view = render(renderMessages([message], renderPanelAppCard));
  const iframe = screen.getByTestId("inline-panel-app");

  view.rerender(
    renderMessages(
      [
        {
          ...message,
          parts: [
            panelPart,
            {
              type: "reasoning",
              label: "Reasoning",
              text: "Continuing after the panel app",
            },
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "read_file",
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool result",
                outputLabel: "Output",
                emptyLabel: "No output",
              },
            },
          ],
        },
      ],
      renderPanelAppCard,
    ),
  );

  expect(screen.getByTestId("inline-panel-app")).toBe(iframe);
});
