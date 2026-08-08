import { render } from "@testing-library/react";
import {
  type ComponentProps,
  type ComponentType,
  useRef,
} from "react";
import type { ChatMessageListProps } from "@nextclaw/agent-chat-ui";
import type { NcpMessage } from "@nextclaw/ncp";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatMessageListContainer as RuntimeChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";

type AgentChatUiModule = {
  ChatMessageList: ComponentType<ChatMessageListProps>;
};

function ChatMessageListContainer(
  props: Omit<
    ComponentProps<typeof RuntimeChatMessageListContainer>,
    "sessionKey" | "scrollRef"
  >,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <RuntimeChatMessageListContainer
      {...props}
      scrollRef={scrollRef}
      sessionKey="session-1"
    />
  );
}

const captures = vi.hoisted(() => ({
  renders: [] as ChatMessageListProps[],
  selectedSession: null as null | {
    agentId: string;
    projectRoot: null;
    sessionType: string;
  },
}));

vi.mock("@nextclaw/agent-chat-ui", async (importOriginal) => ({
  ...((await importOriginal()) as AgentChatUiModule),
  ChatMessageList: (props: ChatMessageListProps) => {
    captures.renders.push(props);
    return <div data-testid="chat-message-list" />;
  },
}));

vi.mock(
  "@/features/chat/features/message/hooks/use-chat-message-virtualizer",
  () => ({
    useChatMessageVirtualizer: ({ rows }: { rows: Array<{ key: string }> }) => ({
      containerRef: vi.fn(),
      virtualizer: {
        getVirtualItems: () => rows.map((_, index) => ({ index, start: 0 })),
        measureElement: vi.fn(),
      },
    }),
  }),
);

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      openFilePreview: vi.fn(),
      handleToolAction: vi.fn(),
    },
    chatUiManager: { showContent: vi.fn() },
  }),
}));

vi.mock(
  "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state",
  () => ({
    useNcpChatSelectedSession: () => captures.selectedSession,
  }),
);

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({ language: "en" }),
}));

vi.mock("@/shared/lib/i18n", () => ({
  formatDateTime: (value: string) => value,
  t: (key: string) => key,
}));

beforeEach(() => {
  captures.renders = [];
  captures.selectedSession = null;
  useChatQueryStore.setState({ snapshot: {} });
  useChatSessionListStore.getState().setSnapshot({ selectedAgentId: "main" });
});

it.each([
  { agentId: "main", sessionType: "native", expected: false },
  { agentId: "engineer", sessionType: "native", expected: true },
  { agentId: "main", sessionType: "codex", expected: true },
])(
  "sets assistant header visibility for $agentId with $sessionType runtime",
  ({ agentId, expected, sessionType }) => {
    captures.selectedSession = { agentId, projectRoot: null, sessionType };

    render(<ChatMessageListContainer messages={[]} isSending />);

    expect(captures.renders.at(-1)?.showAssistantHeader).toBe(expected);
  },
);

it("uses the selected draft agent before the first session materializes", () => {
  render(<ChatMessageListContainer messages={[]} isSending />);

  expect(captures.renders.at(-1)?.showAssistantHeader).toBe(false);
});

it("keeps a new session's empty first assistant draft in the awaiting state", () => {
  captures.selectedSession = {
    agentId: "main",
    projectRoot: null,
    sessionType: "native",
  };
  const messages = [
    {
      id: "user-first",
      sessionId: "session-1",
      role: "user",
      status: "final",
      timestamp: "2026-08-08T10:00:00.000Z",
      parts: [{ type: "text", text: "First message" }],
    },
    {
      id: "assistant-first",
      sessionId: "session-1",
      role: "assistant",
      status: "streaming",
      timestamp: "2026-08-08T10:00:01.000Z",
      parts: [{ type: "text", text: "" }],
    },
  ] satisfies NcpMessage[];

  render(<ChatMessageListContainer messages={messages} isSending />);

  const assistantDraftRender = captures.renders.find(
    (props) => props.messages[0]?.id === "assistant-first",
  );
  expect(assistantDraftRender?.isSending).toBe(true);
});
