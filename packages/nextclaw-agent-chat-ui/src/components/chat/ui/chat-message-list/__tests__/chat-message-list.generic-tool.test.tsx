import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

function toolCard(toolName: string, summary: string, filePaths: string[] = []) {
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
      fileOperation: filePaths.length
        ? {
            blocks: filePaths.map((path) => ({ key: path, path, lines: [] })),
          }
        : undefined,
    },
  };
}

it("summarizes repeated edits by distinct file path", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-repeated-file-edits",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:11",
          parts: [
            toolCard("edit_file", "src/app.ts", ["src/app.ts"]),
            toolCard("edit_file", "src/app.ts", ["src/app.ts"]),
            toolCard("apply_patch", "src/app.ts · src/theme.ts", [
              "src/app.ts",
              "src/theme.ts",
            ]),
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByText("Edit 2 files")).toBeTruthy();
});

it("keeps a manually expanded tool group open while more tools arrive", () => {
  const renderMessage = (toolCount: number) => (
    <ChatMessageList
      messages={[
        {
          id: "assistant-growing-tool-group",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:11",
          status: "streaming",
          parts: Array.from({ length: toolCount }, (_, index) =>
            toolCard("exec_command", `command: command-${index + 1}`),
          ),
        },
      ]}
      isSending
      hasAssistantDraft
      texts={defaultTexts}
    />
  );
  const view = render(renderMessage(2));

  fireEvent.click(screen.getByRole("button", { name: "Run 2 commands" }));
  expect(
    screen.getByRole("button", { name: "Run 2 commands" }).getAttribute("aria-expanded"),
  ).toBe("true");

  view.rerender(renderMessage(3));

  expect(
    screen.getByRole("button", { name: "Run 3 commands" }).getAttribute("aria-expanded"),
  ).toBe("true");
});

it("keeps a manually expanded tool group visible when the message completes", () => {
  const renderMessage = (completed: boolean) => (
    <ChatMessageList
      messages={[
        {
          id: "assistant-completing-tool-group",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:11",
          status: completed ? "final" : "streaming",
          processSummary: completed ? { label: "Processed" } : undefined,
          parts: [
            toolCard("exec_command", "command: pnpm lint"),
            toolCard("exec_command", "command: pnpm test"),
            ...(completed
              ? [{ type: "markdown" as const, text: "Finished." }]
              : []),
          ],
        },
      ]}
      isSending={!completed}
      hasAssistantDraft={!completed}
      texts={defaultTexts}
    />
  );
  const view = render(renderMessage(false));

  fireEvent.click(screen.getByRole("button", { name: "Run 2 commands" }));
  view.rerender(renderMessage(true));

  expect(
    screen.getByRole("button", { name: "Processed" }).getAttribute("aria-expanded"),
  ).toBe("true");
  expect(
    screen.getByRole("button", { name: "Run 2 commands" }).getAttribute("aria-expanded"),
  ).toBe("true");
});

it("renders the workflow rail for a single tool row", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-single-tool-rail",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:11",
          parts: [toolCard("exec_command", "command: pnpm test")],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(
    container.querySelectorAll('[data-tool-workflow-rail="true"]'),
  ).toHaveLength(1);
});

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
  expect(
    screen.getByRole("button", { name: /Reasoning · \d+/ }).querySelector(".lucide-brain"),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Run 2 commands" }).querySelector(".lucide-workflow"),
  ).toBeTruthy();
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
