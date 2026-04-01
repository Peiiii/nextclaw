import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "../chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

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

  fireEvent.click(
    screen.getByText("url: https://example.com/really/long/path"),
  );

  expect(screen.getByText("Input")).toBeTruthy();
  expect(screen.getByText("Output")).toBeTruthy();
  expect(screen.getByText(/"authorization": "Bearer secret-token"/)).toBeTruthy();
  expect(screen.getByText(/"message": "Navigation failed"/)).toBeTruthy();
});
