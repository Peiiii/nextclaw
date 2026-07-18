import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NcpMessage } from "@nextclaw/ncp";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatConversationContent } from "@/features/chat/components/conversation/chat-conversation-content";
import { useChatMessageLayoutStore } from "@/features/chat/stores/chat-message-layout.store";

const captures = vi.hoisted(() => ({
  isAtBottom: true,
  messageListSessionKeys: [] as Array<string | null>,
  onScroll: vi.fn(),
  scrollToBottom: vi.fn(),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  useStickyBottomScroll: () => ({
    isAtBottom: captures.isAtBottom,
    onScroll: captures.onScroll,
    scrollToBottom: captures.scrollToBottom,
  }),
}));

vi.mock("@/features/chat/features/message/components/chat-message-list.container", () => ({
  ChatMessageListContainer: ({ sessionKey }: { sessionKey: string | null }) => {
    captures.messageListSessionKeys.push(sessionKey);
    return <div data-testid="chat-message-list" />;
  },
}));

vi.mock("@/shared/lib/i18n", () => ({
  t: (key: string) => key,
}));

const messages = [
  {
    id: "message-1",
    sessionId: "session-1",
    role: "user",
    status: "final",
    timestamp: "2026-07-04T10:00:00.000Z",
    parts: [{ type: "text", text: "hello" }],
  },
] as unknown as readonly NcpMessage[];

function renderContent(options: { bottomSlot?: React.ReactNode } = {}) {
  return render(
    <ChatConversationContent
      bottomSlot={options.bottomSlot}
      isAwaitingAssistantOutput={false}
      isHistoryLoading={false}
      isSending={false}
      messages={messages}
      sessionKey="session-1"
      showWelcome={false}
    />,
  );
}

beforeEach(() => {
  useChatMessageLayoutStore.getState().setLayout("card");
  captures.isAtBottom = true;
  captures.messageListSessionKeys = [];
  captures.onScroll.mockReset();
  captures.scrollToBottom.mockReset();
});

it("uses the centered reading track in flat message layout", () => {
  useChatMessageLayoutStore.getState().setLayout("flat");

  renderContent();

  const track = screen
    .getByTestId("chat-message-list")
    .closest('[data-chat-conversation-track="flat"]');
  expect(track?.className).toContain("max-w-[min(52rem,100%)]");
  expect(captures.messageListSessionKeys).toEqual(["session-1"]);
});

it("hides the scroll-to-bottom action while the conversation is already at the bottom", () => {
  renderContent();

  expect(screen.queryByRole("button", { name: "chatScrollToBottom" })).toBeNull();
});

it("scrolls to the latest message when the user clicks the floating action", async () => {
  const user = userEvent.setup();
  captures.isAtBottom = false;

  renderContent();
  await user.click(screen.getByRole("button", { name: "chatScrollToBottom" }));

  expect(captures.scrollToBottom).toHaveBeenCalledOnce();
});

it("renders bottom slot after the message list", () => {
  renderContent({
    bottomSlot: <div data-testid="conversation-bottom-slot">Run failed</div>,
  });

  const messageList = screen.getByTestId("chat-message-list");
  const bottomSlot = screen.getByTestId("conversation-bottom-slot");
  expect(
    messageList.compareDocumentPosition(bottomSlot) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
