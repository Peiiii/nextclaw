import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatMessageList } from "./chat-message-list";

it("renders user, assistant, and tool content and supports code copy", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: {
      writeText,
    },
  });

  render(
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
                inputLabel: "Input Summary",
                outputLabel: "View Output",
                emptyLabel: "No output",
                callIdLabel: "Call ID",
                callId: "call-1",
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
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.getByText("You · 10:00")).toBeTruthy();
  expect(screen.getByText("Assistant · 10:01")).toBeTruthy();
  expect(screen.getByText("Tool Result")).toBeTruthy();
  expect(screen.queryByText("Completed")).toBeNull();
  expect(screen.getByText("Typing...")).toBeTruthy();
  expect(screen.getByTestId("chat-message-avatar-user")).toBeTruthy();
  expect(
    screen.getAllByTestId("chat-message-avatar-assistant").length,
  ).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
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
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.getByText("Unknown Part: step-start")).toBeTruthy();
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
                inputLabel: "Input Summary",
                outputLabel: "View Output",
                emptyLabel: "No output",
                callIdLabel: "Call ID",
                callId: "call-running-1",
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
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.getByText("Running")).toBeTruthy();
  expect(screen.getByText("Input Summary")).toBeTruthy();
  expect(screen.getByText("cmd: npm test")).toBeTruthy();
  expect(screen.getByText("Call ID")).toBeTruthy();
  expect(screen.queryByText("View Output")).toBeNull();
});

it("renders reasoning expanded by default while keeping the original details layout", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-3",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:04",
          parts: [
            {
              type: "reasoning",
              label: "Reasoning",
              text: "This is the full reasoning content.\nIt spans multiple lines for inspection.",
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={{
        copyCodeLabel: "Copy",
        copiedCodeLabel: "Copied",
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.getByText("Reasoning")).toBeTruthy();
  const details = document.querySelector("details");
  expect(details?.hasAttribute("open")).toBe(true);
  expect(screen.getByText(/This is the full reasoning content\./)).toBeTruthy();
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
        typingLabel: "Typing...",
      }}
    />,
  );

  expect(screen.queryByText("Assistant · 10:07")).toBeNull();
  expect(screen.getByText("Typing...")).toBeTruthy();
});
