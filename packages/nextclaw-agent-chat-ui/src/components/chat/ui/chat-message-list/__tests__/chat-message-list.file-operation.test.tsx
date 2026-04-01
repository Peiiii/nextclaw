import { act, fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "../chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

it("reveals running file edit previews after the auto-expand delay", () => {
  vi.useFakeTimers();

  try {
    render(
      <ChatMessageList
        messages={[
          {
            id: "assistant-file-preview",
            role: "assistant",
            roleLabel: "Assistant",
            timestampLabel: "10:09",
            parts: [
              {
                type: "tool-card",
                card: {
                  kind: "call",
                  toolName: "edit_file",
                  summary: "src/app.ts",
                  hasResult: false,
                  statusTone: "running",
                  statusLabel: "Running",
                  titleLabel: "Tool Call",
                  outputLabel: "View Output",
                  emptyLabel: "No output",
                  fileOperation: {
                    blocks: [
                      {
                        key: "src/app.ts-1",
                        path: "src/app.ts",
                        lines: [
                          {
                            kind: "remove",
                            text: "const color = 'red';",
                            oldLineNumber: 1,
                          },
                          {
                            kind: "add",
                            text: "const color = 'blue';",
                            newLineNumber: 1,
                          },
                        ],
                      },
                    ],
                  },
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

    expect(screen.queryByText("const color = 'blue';")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getAllByText("src/app.ts")).toHaveLength(2);
    expect(screen.getByText("const color = 'red';")).toBeTruthy();
    expect(screen.getByText("const color = 'blue';")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

it("renders completed file-change cards with an expandable diff view", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-file-change-completed",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:12",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "file_change",
                summary: "src/main.ts",
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool Result",
                outputLabel: "View Output",
                emptyLabel: "No output",
                fileOperation: {
                  blocks: [
                    {
                      key: "src/main.ts-1",
                      path: "src/main.ts",
                      caption: "+1 · -1",
                      lines: [
                        {
                          kind: "remove",
                          text: "console.log('old');",
                          oldLineNumber: 1,
                        },
                        {
                          kind: "add",
                          text: "console.log('new');",
                          newLineNumber: 1,
                        },
                      ],
                    },
                  ],
                },
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

  expect(screen.getByText("src/main.ts")).toBeTruthy();
  expect(screen.queryByText("console.log('new');")).toBeNull();

  fireEvent.click(screen.getByText("src/main.ts"));

  expect(screen.getByText("console.log('old');")).toBeTruthy();
  expect(screen.getByText("console.log('new');")).toBeTruthy();
});

it("keeps large running write previews collapsed until the user asks to inspect them", () => {
  vi.useFakeTimers();

  try {
    render(
      <ChatMessageList
        messages={[
          {
            id: "assistant-large-write-preview",
            role: "assistant",
            roleLabel: "Assistant",
            timestampLabel: "10:18",
            parts: [
              {
                type: "tool-card",
                card: {
                  kind: "call",
                  toolName: "write_file",
                  summary: "src/game.html",
                  hasResult: false,
                  statusTone: "running",
                  statusLabel: "Running",
                  titleLabel: "Tool Call",
                  outputLabel: "View Output",
                  emptyLabel: "No output",
                  fileOperation: {
                    blocks: [
                      {
                        key: "src/game.html-1",
                        path: "src/game.html",
                        truncated: true,
                        lines: Array.from({ length: 40 }, (_, index) => ({
                          kind: "context" as const,
                          text: `line ${index + 1}`,
                          oldLineNumber: index + 1,
                          newLineNumber: index + 1,
                        })),
                      },
                    ],
                  },
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

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("line 1")).toBeNull();

    fireEvent.click(screen.getByText("src/game.html"));

    expect(screen.getByText("line 1")).toBeTruthy();
    expect(screen.getByText("Preview truncated for streaming performance.")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});
