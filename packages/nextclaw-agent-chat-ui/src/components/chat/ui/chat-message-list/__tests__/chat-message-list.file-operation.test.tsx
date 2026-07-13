import { act, fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

const localizedTexts = {
  ...defaultTexts,
  toolStatusLabels: {
    terminal: {
      running: "执行中",
      success: "已执行",
      error: "执行失败",
      cancelled: "已取消执行",
    },
    fileRead: {
      running: "读取中",
      success: "已读取",
      error: "读取失败",
      cancelled: "已取消读取",
    },
    fileEdit: {
      running: "编辑中",
      success: "已编辑",
      error: "编辑失败",
      cancelled: "已取消编辑",
    },
    search: {
      running: "搜索中",
      success: "已搜索",
      error: "搜索失败",
      cancelled: "已取消搜索",
    },
  },
};

function buildWritePreviewLines(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    kind: "add" as const,
    text: `line ${index + 1}`,
    newLineNumber: index + 1,
  }));
}

it("reveals running file edit previews after the auto-expand delay", () => {
  vi.useFakeTimers();

  try {
    const view = render(
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
                          },
                          {
                            kind: "add",
                            text: "const color = 'blue';",
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
        texts={localizedTexts}
      />,
    );

    expect(screen.getByText("编辑中")).toBeTruthy();
    expect(screen.queryByText("const color = 'blue';")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getAllByText("src/app.ts")).toHaveLength(2);
    const codeText = view.container.querySelector('[data-file-code-stack="true"]')?.textContent;
    expect(codeText).toContain("const color = 'red';");
    expect(codeText).toContain("const color = 'blue';");
    expect(
      view.container.querySelectorAll('[data-file-line-number-cell="true"]'),
    ).toHaveLength(0);
    expect(view.container.querySelectorAll("[data-file-line-marker]")).toHaveLength(
      0,
    );
  } finally {
    vi.useRealTimers();
  }
});

it("renders completed file-change cards with an expandable diff view", () => {
  const view = render(
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
                          oldLineNumber: 109,
                        },
                        {
                          kind: "add",
                          text: "console.log('new');",
                          newLineNumber: 109,
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
      texts={localizedTexts}
    />,
  );

  expect(screen.getByText("已编辑")).toBeTruthy();
  expect(screen.getByText("src/main.ts")).toBeTruthy();
  expect(screen.queryByText("console.log('new');")).toBeNull();
  const overviewAdditions = screen.getByText("+1") as HTMLElement;
  const overviewDeletions = screen.getByText("-1") as HTMLElement;
  expect(overviewAdditions.className).toContain(
    "group-hover/process-row:text-emerald-600",
  );
  expect(overviewDeletions.className).toContain(
    "group-hover/process-row:text-rose-600",
  );
  expect(overviewAdditions.parentElement?.className).toContain(
    "text-muted-foreground/75",
  );

  fireEvent.click(screen.getByText("src/main.ts"));

  const codeRows = Array.from(
    view.container.querySelectorAll<HTMLElement>('[data-file-line-row="true"]'),
  );
  expect(codeRows.map((row) => row.textContent)).toEqual([
    "109console.log('old');",
    "109console.log('new');",
  ]);
  const diffLineNumber = screen.getAllByText("109")[0] as HTMLElement;
  expect(diffLineNumber.className).toContain("justify-center");
  expect(diffLineNumber.style.width).toBe("6.5ch");
  expect(
    view.container.querySelectorAll('[data-file-line-number-cell="true"]'),
  ).toHaveLength(2);
  expect(view.container.querySelectorAll("[data-file-line-marker]")).toHaveLength(
    0,
  );
  expect(codeRows[1]?.className).toContain("w-full");
  expect(
    view.container.querySelector('[data-file-code-stack="true"]'),
  ).toBeTruthy();
  const expandedAdditions = screen.getAllByText("+1");
  const expandedDeletions = screen.getAllByText("-1");
  expect(expandedAdditions.at(-1)?.className).toContain("emerald");
  expect(expandedAdditions.at(-1)?.className).not.toContain("rounded");
  expect(expandedDeletions.at(-1)?.className).toContain("rose");
});

it("keeps nested file path header and open action available", () => {
  vi.useFakeTimers();

  try {
    const onFileOpen = vi.fn();
    render(
      <ChatMessageList
        messages={[
          {
            id: "assistant-file-preview-open-action",
            role: "assistant",
            roleLabel: "Assistant",
            timestampLabel: "10:14",
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
                        display: "diff",
                        lines: [
                          {
                            kind: "remove",
                            text: "const color = 'red';",
                            oldLineNumber: 4,
                          },
                          {
                            kind: "add",
                            text: "const color = 'blue';",
                            newLineNumber: 4,
                          },
                        ],
                        beforeText: "const color = 'red';\n",
                        afterText: "const color = 'blue';\n",
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
        onFileOpen={onFileOpen}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Overview summary + nested path header both keep the path visible.
    expect(screen.getAllByText("src/app.ts").length).toBeGreaterThanOrEqual(1);
    const pathButton = screen.getByRole("button", { name: "src/app.ts" });
    fireEvent.click(pathButton);
    expect(onFileOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "src/app.ts",
        viewMode: "diff",
      }),
    );
    expect(
      screen.getByRole("button", { name: "src/app.ts" }).closest("section")?.textContent,
    ).toContain("const color = 'blue';");
  } finally {
    vi.useRealTimers();
  }
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
                        display: "preview",
                        lines: Array.from({ length: 40 }, (_, index) => ({
                          kind: "add" as const,
                          text: `line ${index + 1}`,
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
    expect(screen.queryByText("Showing a shortened diff preview.")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it("keeps non-edit file operation cards collapsed while they are running", () => {
  vi.useFakeTimers();

  try {
    render(
      <ChatMessageList
        messages={[
          {
            id: "assistant-running-file-change",
            role: "assistant",
            roleLabel: "Assistant",
            timestampLabel: "10:20",
            parts: [
              {
                type: "tool-card",
                card: {
                  kind: "call",
                  toolName: "file_change",
                  summary: "src/config.ts",
                  hasResult: false,
                  statusTone: "running",
                  statusLabel: "Running",
                  titleLabel: "Tool Call",
                  outputLabel: "View Output",
                  emptyLabel: "No output",
                  fileOperation: {
                    blocks: [
                      {
                        key: "src/config.ts-1",
                        path: "src/config.ts",
                        lines: [
                          {
                            kind: "remove",
                            text: "export const retries = 1;",
                          },
                          {
                            kind: "add",
                            text: "export const retries = 2;",
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

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByText("export const retries = 2;")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it("renders write previews with a single gutter and without repeating the file path", () => {
  const longLine =
    "const_super_long_editor_line = window.__NEXTCLAW_PREVIEW_SHOULD_SCROLL_HORIZONTALLY__;";

  const view = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-write-preview-compact",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:22",
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
                      display: "preview",
                      caption: "write · +2",
                      lines: [
                        {
                          kind: "add",
                          text: longLine,
                          newLineNumber: 109,
                        },
                        {
                          kind: "add",
                          text: "<script>start()</script>",
                          newLineNumber: 110,
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

  fireEvent.click(screen.getByText("src/game.html"));

  expect(screen.getAllByText("src/game.html")).toHaveLength(2);
  const lineNumber = screen.getByText("109") as HTMLElement;
  expect(lineNumber.className).toContain("justify-center");
  expect(lineNumber.style.width).toBe("6.5ch");
  const pathRow = screen.getByRole("button", { name: "src/game.html" });
  expect(pathRow.className).toContain("truncate");
  expect(pathRow.className).toContain("whitespace-nowrap");
  const writeAdditions = screen.getAllByText("+2");
  expect(writeAdditions.at(-1)?.className).toContain("emerald");
  expect(writeAdditions.at(-1)?.className).not.toContain("rounded");
  expect(
    view.container.querySelectorAll('[data-file-line-number-cell="true"]'),
  ).toHaveLength(2);
  expect(view.container.querySelectorAll("[data-file-line-marker]")).toHaveLength(
    0,
  );
  expect(screen.queryByText("WRITE")).toBeNull();
  expect(screen.getByText(longLine).className).toContain("whitespace-pre");
  expect(
    screen
      .getByText(longLine)
      .closest('[data-file-line-row="true"]')?.className,
  ).toContain("w-full");
  expect(
    view.container.querySelector('[data-file-code-stack="true"]'),
  ).toBeTruthy();
  expect(screen.queryByText("Showing a shortened diff preview.")).toBeNull();
});

it("renders read previews without diff markers", () => {
  const view = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-read-preview",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:24",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "read_file",
                summary: "src/readme.md",
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool Result",
                outputLabel: "View Output",
                emptyLabel: "No output",
                fileOperation: {
                  blocks: [
                    {
                      key: "src/readme.md-1",
                      path: "src/readme.md",
                      display: "preview",
                      lines: [
                        {
                          kind: "context",
                          text: "first line",
                          oldLineNumber: 1,
                          newLineNumber: 1,
                        },
                        {
                          kind: "context",
                          text: "second line",
                          oldLineNumber: 2,
                          newLineNumber: 2,
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

  fireEvent.click(screen.getByText("src/readme.md"));

  expect(screen.getByText("first line")).toBeTruthy();
  expect(screen.getByText("1").className).toContain("justify-center");
  expect(
    view.container.querySelectorAll('[data-file-line-number-cell="true"]'),
  ).toHaveLength(2);
  expect(view.container.querySelectorAll("[data-file-line-marker]")).toHaveLength(
    0,
  );
});

it("keeps growing write previews pinned to the bottom until the user scrolls away", () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});

  const renderPreview = (lineCount: number) => (
    <ChatMessageList
      messages={[
        {
          id: "assistant-sticky-write-preview",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:30",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "call",
                toolName: "write_file",
                summary: "src/live.ts",
                hasResult: false,
                statusTone: "running",
                statusLabel: "Running",
                titleLabel: "Tool Call",
                outputLabel: "View Output",
                emptyLabel: "No output",
                fileOperation: {
                  blocks: [
                    {
                      key: "src/live.ts-1",
                      path: "src/live.ts",
                      display: "preview",
                      lines: buildWritePreviewLines(lineCount),
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
    />
  );

  try {
    const view = render(renderPreview(5));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const scrollArea = view.container.querySelector(
      '[data-file-scroll-kind="block"]',
    ) as HTMLDivElement | null;
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className).not.toContain("overscroll-contain");
    if (!scrollArea) {
      return;
    }

    let scrollHeight = 200;
    Object.defineProperty(scrollArea, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(scrollArea, "clientHeight", {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(scrollArea, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });

    scrollArea.scrollTop = 200;
    fireEvent.scroll(scrollArea);

    scrollHeight = 260;
    act(() => {
      view.rerender(renderPreview(8));
    });

    expect(scrollArea.scrollTop).toBe(260);

    fireEvent.scroll(scrollArea);
    scrollArea.scrollTop = 100;
    fireEvent.scroll(scrollArea);

    scrollHeight = 320;
    act(() => {
      view.rerender(renderPreview(10));
    });

    expect(scrollArea.scrollTop).toBe(100);
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

it("keeps incomplete streamed edit arguments expandable before a structured preview exists", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-partial-edit-input",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:30",
          status: "streaming",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "call",
                toolName: "edit_file",
                summary: "src/live.ts",
                input: '{"path":"src/live.ts","oldText":',
                inputLabel: "Input",
                hasResult: false,
                statusTone: "running",
                statusLabel: "Running",
                titleLabel: "Tool Call",
                outputLabel: "View Output",
                emptyLabel: "No output",
              },
            },
          ],
        },
      ]}
      isSending
      hasAssistantDraft
      texts={defaultTexts}
    />,
  );

  fireEvent.click(screen.getByText("edit file"));

  expect(screen.getByText('{"path":"src/live.ts","oldText":')).toBeTruthy();
});
