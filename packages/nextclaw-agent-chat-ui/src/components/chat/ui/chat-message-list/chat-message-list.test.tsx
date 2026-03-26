import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatMessageList } from "./chat-message-list";

describe("ChatMessageList", () => {
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
          typingLabel: "Typing...",
        }}
      />,
    );

    expect(screen.getByText("You · 10:00")).toBeTruthy();
    expect(screen.getByText("Assistant · 10:01")).toBeTruthy();
    expect(screen.getByText("Tool Result")).toBeTruthy();
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
    expect(
      screen.getByText(/This is the full reasoning content\./),
    ).toBeTruthy();
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

  it("renders image attachments inline", () => {
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

    expect(screen.getByRole("img", { name: "Image attachment" }).className).toContain("rounded-2xl");
    expect(container.querySelector("figure")).toBeNull();
    expect(container.querySelector("figcaption")).toBeNull();
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
});
