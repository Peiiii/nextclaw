import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
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
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
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
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.getByText("Running")).toBeTruthy();
  expect(screen.getByText("cmd: npm test")).toBeTruthy();
  expect(screen.queryByText("Input Summary")).toBeNull();
  expect(screen.queryByText("Call ID")).toBeNull();
  expect(screen.queryByText("View Output")).toBeNull();
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
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.getByText("cmd: pnpm test")).toBeTruthy();
  expect(screen.queryByText("short finished output")).toBeNull();
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

it("renders completed reasoning collapsed by default while keeping the original details layout", () => {
  render(
    <ChatMessageList
      messages={[createReasoningMessage()]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByText("Reasoning")).toBeTruthy();
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
  const summary = screen.getByText("Reasoning");

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
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
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
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.queryByText("Assistant · 10:06")).toBeNull();
  expect(screen.getByText("Typing...")).toBeTruthy();
});

it("renders image attachments as rich preview cards", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-image",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:06",
          parts: [
            {
              type: "file",
              file: {
                label: "Image attachment",
                mimeType: "image/png",
                dataUrl: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
                sizeBytes: 4096,
                isImage: true,
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(
    screen.getByRole("img", { name: "Image attachment" }).className,
  ).toContain("rounded-[1rem]");
  expect(container.querySelector("figure")).toBeTruthy();
  expect(container.querySelector("figcaption")).toBeTruthy();
  expect(screen.getAllByText("4 KB").length).toBeGreaterThan(0);
  expect(screen.getByText("image/png")).toBeTruthy();
});

it("renders non-image attachments as polished file cards", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-file",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:08",
          parts: [
            {
              type: "file",
              file: {
                label: "spec.pdf",
                mimeType: "application/pdf",
                dataUrl: "data:application/pdf;base64,cGRm",
                sizeBytes: 2 * 1024 * 1024,
                isImage: false,
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
    />,
  );

  const link = screen.getByRole("link", { name: /spec\.pdf/i });
  expect(link.getAttribute("href")).toBe("data:application/pdf;base64,cGRm");
  expect(screen.getAllByText("PDF").length).toBeGreaterThan(0);
  expect(screen.getByText("2 MB")).toBeTruthy();
  expect(screen.getByText("application/pdf")).toBeTruthy();
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
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        copyMessageLabel: "Copy",
        copiedMessageLabel: "Copied",
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.queryByText("Assistant · 10:07")).toBeNull();
  expect(screen.getByText("Typing...")).toBeTruthy();
});
