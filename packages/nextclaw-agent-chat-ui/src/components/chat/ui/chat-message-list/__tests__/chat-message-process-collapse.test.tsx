import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

it("collapses completed assistant process content without adding a nested card", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-completed-process",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:12",
          status: "final",
          processSummary: {
            label: "Processed",
          },
          parts: [
            {
              type: "reasoning",
              label: "Reasoning",
              text: "I will inspect the project first.",
            },
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "exec_command",
                summary: "command: pnpm test",
                output: "test output",
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool Result",
                outputLabel: "View Output",
                emptyLabel: "No output",
              },
            },
            {
              type: "markdown",
              text: "Final answer stays visible.",
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  const processDetails = container.querySelector("details");
  expect(screen.getByText("Processed")).toBeTruthy();
  expect(screen.getByText("Final answer stays visible.")).toBeTruthy();
  expect(processDetails?.className).not.toContain("border");
  expect(processDetails?.className).not.toContain("rounded");
  expect(processDetails?.className).not.toContain("bg-");
  expect(processDetails?.hasAttribute("open")).toBe(false);

  fireEvent.click(screen.getByText("Processed"));
  expect(processDetails?.hasAttribute("open")).toBe(true);
});

it("does not collapse in-progress assistant process content", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-streaming-process",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:12",
          status: "streaming",
          processSummary: {
            label: "Processed",
          },
          parts: [
            {
              type: "reasoning",
              label: "Reasoning",
              text: "Still working.",
            },
            {
              type: "markdown",
              text: "Partial answer.",
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft
      texts={defaultTexts}
    />,
  );

  expect(screen.queryByText("Processed")).toBeNull();
  expect(screen.getByText("Still working.")).toBeTruthy();
  expect(screen.getByText("Partial answer.")).toBeTruthy();
});
