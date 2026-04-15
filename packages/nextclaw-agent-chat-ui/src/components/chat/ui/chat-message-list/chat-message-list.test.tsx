import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatMessageList } from "./chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

function createReasoningMessage(status?: "pending" | "streaming" | "completed") {
  return {
    id: "assistant-reasoning",
    role: "assistant" as const,
    roleLabel: "Assistant",
    timestampLabel: "10:04",
    status,
    parts: [
      {
        type: "reasoning" as const,
        label: "Reasoning",
        text: "This is the full reasoning content.\nIt spans multiple lines for inspection.",
      },
    ],
  };
}

it("renders user, assistant, and tool content and supports code copy", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: {
      writeText,
    },
  });

  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "user-1",
          role: "user",
          roleLabel: "You",
          timestampLabel: "10:00",
          parts: [{ type: "markdown", text: "Hello" }],
        },
        {
          id: "assistant-1",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:01",
          parts: [{ type: "markdown", text: "```ts\nconst x = 1;\n```" }],
        },
        {
          id: "tool-1",
          role: "tool",
          roleLabel: "Tool",
          timestampLabel: "10:02",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "web_search",
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool Result",
                outputLabel: "View Output",
                emptyLabel: "No output",
                output: "done",
              },
            },
          ],
        },
      ]}
      isSending
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByText("You · 10:00")).toBeTruthy();
  expect(screen.getByText("Assistant · 10:01")).toBeTruthy();
  expect(screen.getByText("Tool · 10:02")).toBeTruthy();
  expect(screen.queryByText("Completed")).toBeNull();
  expect(screen.queryByText("Input Summary")).toBeNull();
  expect(screen.queryByText("Call ID")).toBeNull();
  expect(screen.getByText("Typing...")).toBeTruthy();
  expect(screen.getByTestId("chat-message-avatar-user")).toBeTruthy();
  expect(
    screen.getAllByTestId("chat-message-avatar-assistant").length,
  ).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: "Copy" }).length).toBe(2);

  const codeCopyButton = container.querySelector(".chat-codeblock-copy");
  expect(codeCopyButton).toBeTruthy();
  fireEvent.click(codeCopyButton as HTMLButtonElement);
  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith("const x = 1;");
  });
});

it("renders unknown parts with fallback label", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-2",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:03",
          parts: [
            {
              type: "unknown",
              label: "Unknown Part",
              rawType: "step-start",
              text: '{"x":1}',
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByText("Unknown Part: step-start")).toBeTruthy();
});

it("renders inline token content inside a user message bubble", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "user-inline-token",
          role: "user",
          roleLabel: "You",
          timestampLabel: "10:05",
          parts: [
            {
              type: "inline-content",
              segments: [
                { type: "markdown", text: "please use " },
                {
                  type: "token",
                  token: {
                    kind: "skill",
                    key: "weather",
                    label: "Weather",
                    rawText: "$weather",
                  },
                },
                { type: "markdown", text: " now" },
              ],
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByText("please use", { exact: false })).toBeTruthy();
  expect(screen.getByText("Weather")).toBeTruthy();
  expect(screen.getByText("now", { exact: false })).toBeTruthy();
});

it("renders running tool cards with live status feedback", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-tool-running",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:09",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "call",
                toolName: "exec_command",
                summary: "cmd: npm test",
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
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByText("Running")).toBeTruthy();
  expect(screen.getByText("cmd: npm test")).toBeTruthy();
  expect(screen.queryByText("Input Summary")).toBeNull();
  expect(screen.queryByText("Call ID")).toBeNull();
  expect(screen.queryByText("View Output")).toBeNull();
});

it("renders injected agent identity content for tool cards with agentId", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-tool-agent",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:10",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "call",
                toolName: "spawn",
                agentId: "planner-agent",
                summary: "task: Plan the rollout",
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
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
      renderToolAgent={(agentId) => (
        <div data-testid="tool-agent-identity">{agentId}</div>
      )}
    />,
  );

  expect(screen.getByTestId("tool-agent-identity").textContent).toBe("planner-agent");
});

it("keeps long-running generic tool cards collapsed until the user asks to inspect them", () => {
  vi.useFakeTimers();

  try {
    render(
      <ChatMessageList
        messages={[
          {
            id: "assistant-tool-delayed-expand",
            role: "assistant",
            roleLabel: "Assistant",
            timestampLabel: "10:09",
            parts: [
              {
                type: "tool-card",
                card: {
                  kind: "call",
                  toolName: "exec_command",
                  summary: "command: pnpm dev",
                  output: "streamed result body",
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
        isSending={false}
        hasAssistantDraft={false}
        texts={defaultTexts}
      />,
    );

    expect(screen.queryByText("streamed result body")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("streamed result body")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it("keeps fast-completing tool cards collapsed instead of flashing open", () => {
  vi.useFakeTimers();

  const runningMessage = {
    id: "assistant-tool-fast-finish",
    role: "assistant" as const,
    roleLabel: "Assistant",
    timestampLabel: "10:09",
    parts: [
      {
        type: "tool-card" as const,
        card: {
          kind: "call" as const,
          toolName: "exec_command",
          summary: "command: pnpm lint",
          output: "flash prone body",
          hasResult: false,
          statusTone: "running" as const,
          statusLabel: "Running",
          titleLabel: "Tool Call",
          outputLabel: "View Output",
          emptyLabel: "No output",
        },
      },
    ],
  };

  try {
    const { rerender } = render(
      <ChatMessageList
        messages={[runningMessage]}
        isSending={false}
        hasAssistantDraft={false}
        texts={defaultTexts}
      />,
    );

    expect(screen.queryByText("flash prone body")).toBeNull();

    rerender(
      <ChatMessageList
        messages={[
          {
            ...runningMessage,
            parts: [
              {
                ...runningMessage.parts[0],
                card: {
                  ...runningMessage.parts[0].card,
                  kind: "result",
                  hasResult: true,
                  statusTone: "success",
                  statusLabel: "Completed",
                  titleLabel: "Tool Result",
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

    expect(screen.queryByText("flash prone body")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it("renders completed terminal tool cards collapsed by default on initial mount", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-tool-completed",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:10",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "shell",
                summary: "cmd: pnpm test",
                output: "short finished output",
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

  expect(screen.getByText("cmd: pnpm test")).toBeTruthy();
  expect(screen.queryByText("short finished output")).toBeNull();
});

it("renders structured terminal payloads as terminal output instead of raw json", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-tool-json-output",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:13",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "exec_command",
                summary: "command: pnpm test",
                output: JSON.stringify({
                  ok: true,
                  command: "pnpm test",
                  stdout: "\u001b[32mfirst line\u001b[39m\nsecond line",
                  stderr: "warning line",
                  exitCode: 0,
                }),
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

  fireEvent.click(screen.getByText("pnpm test"));

  expect(screen.getByText(/first line/)).toBeTruthy();
  expect(screen.getByText(/second line/)).toBeTruthy();
  expect(screen.getByText(/warning line/)).toBeTruthy();
  expect(screen.queryByText(/"stdout":/)).toBeNull();
});

it("suppresses structured terminal payload json when the command produced no terminal output", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-tool-empty-structured-output",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:14",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "command_execution",
                summary: "command: python3 -m http.server 8765",
                output: JSON.stringify({
                  ok: true,
                  command: "python3 -m http.server 8765",
                  workingDir: "/Users/peiwang/.nextclaw/workspace",
                  exitCode: 0,
                  stdout: "",
                  stderr: "",
                  durationMs: 60002,
                  timedOut: false,
                  killed: false,
                }),
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

  fireEvent.click(screen.getByText("python3 -m http.server 8765"));

  expect(screen.queryByText(/"durationMs": 60002/)).toBeNull();
  expect(screen.queryByText(/"workingDir":/)).toBeNull();
});

it("resets completed terminal tool cards to collapsed when the message list remounts", () => {
  const message = {
    id: "assistant-tool-remount",
    role: "assistant" as const,
    roleLabel: "Assistant",
    timestampLabel: "10:11",
    parts: [
      {
        type: "tool-card" as const,
        card: {
          kind: "result" as const,
          toolName: "shell",
          summary: "cmd: pnpm test",
          output: "short finished output",
          hasResult: true,
          statusTone: "success" as const,
          statusLabel: "Completed",
          titleLabel: "Tool Result",
          outputLabel: "View Output",
          emptyLabel: "No output",
        },
      },
    ],
  };

  const { rerender } = render(
    <ChatMessageList
      key="session-a"
      messages={[message]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  fireEvent.click(screen.getByText("cmd: pnpm test"));
  expect(screen.getByText("short finished output")).toBeTruthy();

  rerender(
    <ChatMessageList
      key="session-b"
      messages={[message]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.queryByText("short finished output")).toBeNull();
});

it("renders completed reasoning as a collapsed thought block while keeping the original details layout", () => {
  render(
    <ChatMessageList
      messages={[createReasoningMessage()]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByText("思考")).toBeTruthy();
  const details = document.querySelector("details");
  expect(details?.hasAttribute("open")).toBe(false);
  expect(screen.getByText(/This is the full reasoning content\./)).toBeTruthy();
});

it("auto-collapses reasoning after the current streaming queue finishes", () => {
  const { container, rerender } = render(
    <ChatMessageList
      messages={[createReasoningMessage("streaming")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  const details = () => container.querySelector("details");
  expect(details()?.hasAttribute("open")).toBe(true);

  rerender(
    <ChatMessageList
      messages={[createReasoningMessage("completed")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(details()?.hasAttribute("open")).toBe(false);
});

it("keeps earlier reasoning queues collapsed while only the current queue stays expanded", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-reasoning-multi",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:05",
          status: "streaming",
          parts: [
            {
              type: "reasoning",
              label: "Reasoning",
              text: "Finished queue",
            },
            {
              type: "reasoning",
              label: "Reasoning",
              text: "Current queue",
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  const detailsList = Array.from(container.querySelectorAll("details"));
  expect(detailsList).toHaveLength(2);
  expect(detailsList[0]?.hasAttribute("open")).toBe(false);
  expect(detailsList[1]?.hasAttribute("open")).toBe(true);
});

it("keeps reasoning expanded after completion when the user manually re-opens it", () => {
  const { container, rerender } = render(
    <ChatMessageList
      messages={[createReasoningMessage("streaming")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  const details = () => container.querySelector("details");
  const summary = screen.getByText("思考");

  expect(details()?.hasAttribute("open")).toBe(true);

  fireEvent.click(summary);
  expect(details()?.hasAttribute("open")).toBe(false);

  fireEvent.click(summary);
  expect(details()?.hasAttribute("open")).toBe(true);

  rerender(
    <ChatMessageList
      messages={[createReasoningMessage("completed")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(details()?.hasAttribute("open")).toBe(true);
});

it("keeps streaming thought content pinned to the bottom until the user scrolls away", () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});

  const renderReasoning = (text: string) => (
    <ChatMessageList
      messages={[
        {
          ...createReasoningMessage("streaming"),
          parts: [
            {
              type: "reasoning" as const,
              label: "Reasoning",
              text,
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
    const view = render(renderReasoning("line 1\nline 2\nline 3"));
    const scrollArea = view.container.querySelector(
      '[data-reasoning-scroll="true"]',
    ) as HTMLDivElement | null;

    expect(screen.getByText("思考")).toBeTruthy();
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className).toContain("max-h-56");
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

    scrollHeight = 280;
    act(() => {
      view.rerender(renderReasoning("line 1\nline 2\nline 3\nline 4\nline 5"));
    });

    expect(scrollArea.scrollTop).toBe(280);

    fireEvent.scroll(scrollArea);
    scrollArea.scrollTop = 120;
    fireEvent.scroll(scrollArea);

    scrollHeight = 340;
    act(() => {
      view.rerender(renderReasoning("line 1\nline 2\nline 3\nline 4\nline 5\nline 6"));
    });

    expect(scrollArea.scrollTop).toBe(120);
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

it("does not render the typing placeholder after assistant output has started but is still pending", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-pending",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:05",
          status: "pending",
          parts: [
            { type: "reasoning", label: "Reasoning", text: "Thinking..." },
          ],
        },
      ]}
      isSending
      hasAssistantDraft
      texts={defaultTexts}
    />,
  );

  expect(screen.queryByText("Typing...")).toBeNull();
  expect(screen.getByText("Thinking...")).toBeTruthy();
});

it("uses the typing placeholder instead of rendering an empty assistant draft bubble", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-empty",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:06",
          status: "pending",
          parts: [],
        },
      ]}
      isSending
      hasAssistantDraft
      texts={defaultTexts}
    />,
  );

  expect(screen.queryByText("Assistant · 10:06")).toBeNull();
  expect(screen.getByText("Typing...")).toBeTruthy();
});

it("treats whitespace-only and zero-width markdown drafts as loading instead of visible bubbles", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-zero-width",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:07",
          status: "streaming",
          parts: [{ type: "markdown", text: "\u200B\u200B" }],
        },
      ]}
      isSending
      hasAssistantDraft
      texts={defaultTexts}
    />,
  );

  expect(screen.queryByText("Assistant · 10:07")).toBeNull();
  expect(screen.getByText("Typing...")).toBeTruthy();
});
