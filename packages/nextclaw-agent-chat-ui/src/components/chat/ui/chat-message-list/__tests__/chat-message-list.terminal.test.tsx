import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "../chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

it("renders structured terminal result objects without showing raw json payloads", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-terminal-object-output",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:15",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "command_execution",
                summary: "command: echo hello",
                outputData: {
                  status: "completed",
                  command: "echo hello",
                  aggregated_output: "hello\n",
                  exit_code: 0,
                },
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool Result",
                outputLabel: "View Output",
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

  fireEvent.click(screen.getByText("echo hello"));

  expect(screen.getByText("hello")).toBeTruthy();
  expect(screen.queryByText(/"aggregated_output":/)).toBeNull();
  expect(screen.queryByText(/"status": "completed"/)).toBeNull();
});
