import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

function toolCard(toolName: string, summary: string) {
  return {
    type: "tool-card" as const,
    card: {
      kind: "result" as const,
      toolName,
      summary,
      hasResult: true,
      statusTone: "success" as const,
      statusLabel: "Completed",
      titleLabel: "Tool Result",
      outputLabel: "View Output",
      emptyLabel: "No output",
    },
  };
}

it("connects tool rows across intervening reasoning from icon center to icon center", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-tool-workflow-rail",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:10",
          parts: [
            toolCard("exec_command", "command: pnpm lint"),
            {
              type: "reasoning",
              label: "Reasoning",
              text: "Check the result before continuing.",
            },
            toolCard("exec_command", "command: pnpm test"),
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  fireEvent.click(screen.getByText("Run 2 commands"));

  const rails = Array.from(
    container.querySelectorAll<HTMLElement>('[data-tool-workflow-rail="true"]'),
  );
  expect(screen.getByText(/Reasoning · \d+/)).toBeTruthy();
  expect(rails).toHaveLength(3);
  expect(rails[0]?.className).toContain("top-[0.86em]");
  expect(rails[0]?.className).toContain("bottom-0");
  expect(rails[1]?.className).toContain("inset-y-0");
  expect(rails[2]?.className).toContain("top-0");
  expect(rails[2]?.className).toContain("h-[0.86em]");
});

it("renders generic tool cards with distinct input and output sections", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-generic-tool-input",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:09",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "call",
                toolName: "open_url",
                summary: "url: https://example.com/really/long/path",
                inputLabel: "Input",
                input: `{
  "url": "https://example.com/really/long/path",
  "headers": {
    "authorization": "Bearer secret-token"
  },
  "mode": "reader"
}`,
                output: `{
  "ok": false,
  "error": {
    "message": "Navigation failed"
  }
}`,
                hasResult: true,
                statusTone: "error",
                statusLabel: "Failed",
                titleLabel: "Tool Call",
                outputLabel: "Output",
                emptyLabel: "No output",
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.queryByText(/"authorization": "Bearer secret-token"/)).toBeNull();

  fireEvent.click(screen.getByText("open url"));

  expect(screen.getByText("Input")).toBeTruthy();
  expect(screen.getByText("Output")).toBeTruthy();
  expect(screen.getByText(/"authorization": "Bearer secret-token"/)).toBeTruthy();
  expect(screen.getByText(/"message": "Navigation failed"/)).toBeTruthy();
});
