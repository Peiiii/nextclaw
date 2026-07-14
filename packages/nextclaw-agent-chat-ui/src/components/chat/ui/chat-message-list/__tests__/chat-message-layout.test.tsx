import { render, screen, within } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const texts = {
  copyCodeLabel: "Copy code",
  copiedCodeLabel: "Code copied",
  copyMessageLabel: "Copy message",
  copiedMessageLabel: "Message copied",
  typingLabel: "Typing...",
};

describe("ChatMessageList layout", () => {
  it("keeps the user bubble while rendering assistant content flat", () => {
    const { container } = render(
      <ChatMessageList
        layout="flat"
        messages={[
          {
            id: "user",
            role: "user",
            roleLabel: "You",
            timestampLabel: "10:00",
            parts: [{ type: "markdown", text: "Question" }],
          },
          {
            id: "assistant",
            role: "assistant",
            roleLabel: "Assistant",
            timestampLabel: "10:01",
            parts: [{ type: "markdown", text: "Answer" }],
          },
        ]}
        isSending={false}
        hasAssistantDraft={false}
        texts={texts}
      />,
    );

    expect(
      container.querySelectorAll('[data-chat-message-layout="flat"]'),
    ).toHaveLength(1);
    expect(
      container.querySelector(
        '[data-chat-message-layout="card"] .nextclaw-chat-message-user',
      ),
    ).toBeTruthy();
    const flatSurface = container.querySelector(
      '[data-chat-message-layout="flat"] [data-chat-message-surface="flat"]',
    );
    const flatHeader = container.querySelector(
      '[data-chat-message-header="flat"]',
    ) as HTMLElement;
    const flatBody = container.querySelector('[data-chat-message-body="flat"]');
    const flatFooter = container.querySelector(
      '[data-chat-message-footer="flat"]',
    ) as HTMLElement;
    expect(flatSurface?.className).toContain("w-full");
    expect(flatSurface?.className).not.toContain("bg-card");
    expect(flatBody?.className).toContain("w-full");
    expect(flatBody?.className).not.toContain("pl-10");
    expect(
      flatHeader.querySelector('[data-testid="chat-message-avatar-assistant"]')
        ?.className,
    ).toContain("h-7");
    expect(
      container.querySelector('[data-testid="chat-message-avatar-user"]')
        ?.className,
    ).toContain("h-8");
    expect(within(flatHeader).getByText("Assistant")).toBeTruthy();
    expect(within(flatHeader).queryByText("10:01")).toBeNull();
    expect(
      within(flatHeader).queryByRole("button", { name: "Copy message" }),
    ).toBeNull();
    expect(within(flatFooter).getByText("10:01")).toBeTruthy();
    expect(
      within(flatFooter).getByRole("button", { name: "Copy message" }),
    ).toBeTruthy();
    expect(
      within(screen.getByText("You · 10:00").parentElement!).getByRole(
        "button",
        { name: "Copy message" },
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Assistant · 10:01")).toBeNull();
  });

  it("uses a flat typing indicator when no assistant draft exists", () => {
    const { container } = render(
      <ChatMessageList
        layout="flat"
        messages={[]}
        isSending
        hasAssistantDraft={false}
        texts={texts}
      />,
    );

    const typingSurface = container.querySelector(
      '[data-chat-message-surface="flat"]',
    );
    expect(typingSurface?.className).not.toContain("rounded-2xl");
    expect(screen.getByText("Typing...")).toBeTruthy();
  });
});
