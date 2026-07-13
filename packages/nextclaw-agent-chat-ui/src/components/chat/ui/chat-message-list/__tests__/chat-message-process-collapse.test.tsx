import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

function createReasoningMessage(status?: "streaming" | "completed") {
  return {
    id: "assistant-reasoning-count",
    role: "assistant" as const,
    roleLabel: "Assistant",
    timestampLabel: "10:04",
    status,
    parts: [
      {
        type: "reasoning" as const,
        label: "Reasoning",
        text: "This is the full reasoning content.",
      },
    ],
  };
}

it("renders completed reasoning collapsed with its character count", () => {
  render(
    <ChatMessageList
      messages={[createReasoningMessage()]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  const summary = screen.getByRole("button", { name: /Reasoning · \d+/ });
  expect(summary.getAttribute("aria-expanded")).toBe("false");
  expect(summary.getAttribute("data-chat-process-meta-row")).toBe("true");
  expect(summary.className).toContain("text-[0.925rem]");
  expect(summary.className).toContain("leading-[1.72]");
  expect(summary.className).toContain("text-muted-foreground/80");
  expect(screen.queryByText("This is the full reasoning content.")).toBeNull();
});

it("localizes reasoning progress and completion around the live character count", () => {
  const texts = {
    ...defaultTexts,
    reasoningCharacterCountTemplates: {
      inProgress: "思考中 · 已思考 {count} 个字符",
      completed: "已思考 {count} 个字符",
    },
  };
  const { rerender } = render(
    <ChatMessageList
      messages={[createReasoningMessage("streaming")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={texts}
    />,
  );

  expect(screen.getByText(/思考中 · 已思考 \d+ 个字符/)).toBeTruthy();

  rerender(
    <ChatMessageList
      messages={[createReasoningMessage("completed")]}
      isSending={false}
      hasAssistantDraft={false}
      texts={texts}
    />,
  );

  expect(screen.getByText(/已思考 \d+ 个字符/)).toBeTruthy();
  expect(screen.queryByText(/思考中/)).toBeNull();
});

it("lets a user escape reasoning auto-scroll after moving 20px from the bottom", () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  try {
    const view = render(
      <ChatMessageList
        messages={[createReasoningMessage("streaming")]}
        isSending
        hasAssistantDraft
        texts={defaultTexts}
      />,
    );
    const scrollArea = view.container.querySelector(
      '[data-reasoning-scroll="true"]',
    ) as HTMLDivElement | null;
    expect(scrollArea).toBeTruthy();
    if (!scrollArea) {
      return;
    }

    let scrollHeight = 200;
    Object.defineProperties(scrollArea, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
      scrollTop: { configurable: true, value: 79, writable: true },
    });
    fireEvent.scroll(scrollArea);

    scrollHeight = 260;
    view.rerender(
      <ChatMessageList
        messages={[
          {
            ...createReasoningMessage("streaming"),
            parts: [
              {
                type: "reasoning",
                label: "Reasoning",
                text: "This is the full reasoning content with more streamed text.",
              },
            ],
          },
        ]}
        isSending
        hasAssistantDraft
        texts={defaultTexts}
      />,
    );

    expect(scrollArea.scrollTop).toBe(79);
  } finally {
    vi.unstubAllGlobals();
  }
});

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

  expect(screen.getByText("Processed")).toBeTruthy();
  const processDivider = screen.getByText("Processed").closest("button")?.parentElement;
  expect(processDivider?.className).toContain("mb-2");
  expect(processDivider?.className).toContain("pb-2");
  expect(processDivider?.className).toContain("border-b");
  expect(screen.getByText("Final answer stays visible.")).toBeTruthy();
  expect(screen.queryByText("详情")).toBeNull();
  expect(screen.queryByText("Details")).toBeNull();
  // Controlled collapse no longer relies on native <details>.
  expect(container.querySelector("details")).toBeNull();
  expect(screen.queryByText("I will inspect the project first.")).toBeNull();

  fireEvent.click(screen.getByText("Processed"));
  expect(screen.getByText(/Reasoning · \d+/)).toBeTruthy();
  expect(screen.queryByText("I will inspect the project first.")).toBeNull();
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
  expect(screen.getByText(/Reasoning · \d+/)).toBeTruthy();
  expect(screen.queryByText("Still working.")).toBeNull();
  expect(screen.getByText("Partial answer.")).toBeTruthy();
});
