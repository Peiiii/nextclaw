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
          executionSummaryLabel: "openai/gpt-5 · 120 input / 30 output",
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
  expect(
    screen.getByText("Assistant · 10:01 · openai/gpt-5 · 120 input / 30 output"),
  ).toBeTruthy();
  expect(screen.getByText("Tool · 10:02")).toBeTruthy();
  expect(screen.queryByText("Completed")).toBeNull();
  expect(screen.queryByText("Input Summary")).toBeNull();
  expect(screen.queryByText("Call ID")).toBeNull();
  expect(screen.getByText("Typing...")).toBeTruthy();
  expect(screen.getByTestId("chat-message-avatar-user")).toBeTruthy();
  expect(container.querySelector(".nextclaw-chat-message-user")).toBeTruthy();
  expect(
    screen.getAllByTestId("chat-message-avatar-assistant").length,
  ).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: "Copy" }).length).toBe(3);
  expect(screen.getByText("Typing...").className).toContain(
    "nextclaw-chat-typing-indicator__text",
  );
  expect(container.querySelector("style")?.textContent).toContain(
    "nextclaw-chat-typing-text-sheen",
  );
  expect(container.querySelector("style")?.textContent).toContain("2.5s");
  expect(container.querySelector("style")?.textContent).toContain("infinite");

  const codeCopyButton = container.querySelector(".chat-codeblock-copy");
  expect(codeCopyButton).toBeTruthy();
  fireEvent.click(codeCopyButton as HTMLButtonElement);
  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith("const x = 1;");
  });

  const userFooter = screen.getByText("You · 10:00").parentElement;
  const userCopyButton = userFooter?.querySelector<HTMLButtonElement>(
    'button[aria-label="Copy"]',
  );
  expect(userCopyButton).toBeTruthy();
  fireEvent.click(userCopyButton!);
  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith("Hello");
  });
});

it("opens persisted run metadata from the message more-actions menu", async () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-metadata",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:02",
          parts: [{ type: "markdown", text: "Done" }],
          moreActions: {
            triggerLabel: "More actions",
            items: [
              {
                key: "ai-execution-metadata",
                label: "View run metadata",
                dialog: {
                  title: "AI run metadata",
                  description: "Runtime facts",
                  closeLabel: "Close run metadata",
                  rows: [
                    { label: "Model", value: "openai/gpt-5" },
                    { label: "Cached input tokens", value: "128k (128000)" },
                  ],
                },
              },
            ],
          },
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "View run metadata" }));

  expect(await screen.findByRole("dialog", { name: "AI run metadata" })).toBeTruthy();
  expect(screen.getByText("Cached input tokens")).toBeTruthy();
  expect(screen.getByText("128k (128000)")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close run metadata" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "AI run metadata" })).toBeNull();
  });
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "More actions" }),
  );
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

it("uses the host assistant icon for messages and the typing placeholder", () => {
  render(
    <ChatMessageList
      assistantAvatarIcon={<span data-testid="runtime-avatar-icon" />}
      messages={[
        {
          id: "assistant-runtime",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:05",
          parts: [{ type: "markdown", text: "Runtime response" }],
        },
      ]}
      isSending
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getAllByTestId("runtime-avatar-icon")).toHaveLength(2);
  expect(screen.getAllByTestId("chat-message-avatar-assistant")).toHaveLength(2);
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
              type: "markdown",
              text: "please use $weather now",
              inlineTokens: [
                {
                  kind: "skill",
                  key: "weather",
                  label: "Weather",
                  rawText: "$weather",
                },
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

it("renders user inline tokens with markdown link metrics", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "user-inline-panel-app",
          role: "user",
          roleLabel: "You",
          timestampLabel: "10:06",
          parts: [
            {
              type: "markdown",
              text: "review @panel-app:task-board",
              inlineTokens: [
                {
                  kind: "panel_app",
                  key: "task-board",
                  label: "Task Board",
                  rawText: "@panel-app:task-board",
                },
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

  const token = screen.getByText("Task Board").parentElement;
  expect(token?.className).toContain("nextclaw-chat-inline-token");
  expect(token?.className).toContain("text-[1em]");
  expect(token?.className).toContain("leading-[inherit]");
  expect(token?.className).not.toContain("h-7");
});

it("renders skill tokens as link-styled interactive entities with a tooltip", async () => {
  const onInlineTokenClick = vi.fn();
  render(
    <ChatMessageList
      messages={[
        {
          id: "user-inline-skill",
          role: "user",
          roleLabel: "You",
          timestampLabel: "10:07",
          parts: [
            {
              type: "markdown",
              text: "use $weather now",
              inlineTokens: [
                {
                  kind: "skill",
                  key: "weather",
                  label: "Weather",
                  rawText: "$weather",
                },
              ],
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
      onInlineTokenClick={onInlineTokenClick}
    />,
  );

  const skillButton = screen.getByRole("button", { name: "Weather" });
  expect(skillButton.className).toContain("nextclaw-chat-inline-token");
  expect(skillButton.className).toContain("text-[color:var(--md-link)]");
  fireEvent.pointerMove(skillButton, { pointerType: "mouse" });
  expect((await screen.findByRole("tooltip")).textContent).toBe("weather");
  fireEvent.click(skillButton);
  expect(onInlineTokenClick).toHaveBeenCalledWith({
    kind: "skill",
    key: "weather",
    label: "Weather",
    rawText: "$weather",
  });
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

it("auto-collapses reasoning after the current streaming queue finishes", () => {
  const { rerender } = render(
    <ChatMessageList
      messages={[createReasoningMessage("streaming")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(
    screen.getByRole("button", { name: /Reasoning · \d+/ }).getAttribute("aria-expanded"),
  ).toBe("true");
  expect(screen.getByText(/This is the full reasoning content\./)).toBeTruthy();

  rerender(
    <ChatMessageList
      messages={[createReasoningMessage("completed")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(
    screen.getByRole("button", { name: /Reasoning · \d+/ }).getAttribute("aria-expanded"),
  ).toBe("false");
  expect(screen.queryByText(/This is the full reasoning content\./)).toBeNull();
});

it("keeps earlier reasoning queues collapsed while only the current queue stays expanded", () => {
  render(
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

  const buttons = screen.getAllByRole("button", { name: /Reasoning · \d+/ });
  expect(buttons).toHaveLength(2);
  expect(buttons[0]?.getAttribute("aria-expanded")).toBe("false");
  expect(buttons[1]?.getAttribute("aria-expanded")).toBe("true");
  expect(screen.queryByText("Finished queue")).toBeNull();
  expect(screen.getByText("Current queue")).toBeTruthy();
});

it("keeps reasoning expanded after completion when the user manually re-opens it", () => {
  const { rerender } = render(
    <ChatMessageList
      messages={[createReasoningMessage("streaming")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  const summary = screen.getByRole("button", { name: /Reasoning · \d+/ });
  expect(summary.getAttribute("aria-expanded")).toBe("true");

  fireEvent.click(summary);
  expect(summary.getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(summary);
  expect(summary.getAttribute("aria-expanded")).toBe("true");

  rerender(
    <ChatMessageList
      messages={[createReasoningMessage("completed")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(
    screen.getByRole("button", { name: /Reasoning · \d+/ }).getAttribute("aria-expanded"),
  ).toBe("true");
  expect(screen.getByText(/This is the full reasoning content\./)).toBeTruthy();
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

    expect(screen.getByText("Reasoning · 20")).toBeTruthy();
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
