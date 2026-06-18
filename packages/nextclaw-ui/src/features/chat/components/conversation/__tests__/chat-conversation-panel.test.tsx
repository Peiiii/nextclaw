import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatConversationPanel } from "@/features/chat/components/conversation/chat-conversation-panel";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";

const mocks = vi.hoisted(() => ({
  goToSession: vi.fn(),
  isAtChatRoot: vi.fn(() => true),
}));
const persistStorage = new Map<string, unknown>();

function createPersistStorage() {
  return {
    getItem: (name: string) => persistStorage.get(name) ?? null,
    setItem: (name: string, value: unknown) => {
      persistStorage.set(name, value);
    },
    removeItem: (name: string) => {
      persistStorage.delete(name);
    },
  };
}

vi.mock("@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state", () => ({
  useNcpChatProviderStateResolved: () => true,
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatUiManager: {
      goToSession: mocks.goToSession,
      isAtChatRoot: mocks.isAtChatRoot,
    },
  }),
}));

vi.mock("@/features/chat/components/conversation/chat-conversation-parent-banner", () => ({
  ChatConversationParentBanner: () => null,
}));

vi.mock("@/features/chat/components/conversation/chat-conversation-header-section", () => ({
  ChatConversationHeaderSection: () => <div data-testid="chat-header" />,
}));

vi.mock("@/features/chat/components/conversation/chat-conversation-skeleton", () => ({
  ChatConversationSkeleton: () => <div data-testid="chat-skeleton" />,
}));

vi.mock("@/features/chat/components/conversation/chat-conversation-workspace-section", () => ({
  ChatConversationWorkspaceSection: ({ sessionKey }: { sessionKey: string | null }) => (
    <div data-testid="workspace-section" data-session-key={sessionKey ?? ""} />
  ),
}));

vi.mock("@/features/chat/features/conversation/components/session-conversation-area", () => ({
  SessionConversationArea: ({
    consumeDraftIntent,
    onSessionMaterialized,
    sessionKey,
  }: {
    consumeDraftIntent?: boolean;
    onSessionMaterialized?: (sessionKey: string) => void;
    sessionKey: string | null;
  }) => (
    <button
      type="button"
      data-testid="session-conversation-area"
      data-consume-draft-intent={String(Boolean(consumeDraftIntent))}
      data-session-key={sessionKey ?? ""}
      onClick={() => onSessionMaterialized?.("materialized-session")}
    >
      area
    </button>
  ),
}));

describe("ChatConversationPanel", () => {
  beforeEach(() => {
    persistStorage.clear();
    useChatSessionListStore.persist.setOptions({ storage: createPersistStorage() as never });
    mocks.goToSession.mockReset();
    mocks.isAtChatRoot.mockReset();
    mocks.isAtChatRoot.mockReturnValue(true);
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: null,
      },
    });
  });

  it("passes the selected session key into the self-contained conversation area and workspace", () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: "session-1",
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.getByTestId("chat-header")).toBeTruthy();
    expect(screen.getByTestId("session-conversation-area").dataset).toMatchObject({
      sessionKey: "session-1",
      consumeDraftIntent: "true",
    });
    expect(screen.getByTestId("workspace-section").dataset.sessionKey).toBe("session-1");
  });

  it("materializes root draft sessions through the UI manager route owner", async () => {
    const user = userEvent.setup();

    render(<ChatConversationPanel />);
    await user.click(screen.getByTestId("session-conversation-area"));

    expect(mocks.goToSession).toHaveBeenCalledWith("materialized-session", {
      replace: true,
    });
  });

  it("does not materialize through the root route callback outside chat root", async () => {
    const user = userEvent.setup();
    mocks.isAtChatRoot.mockReturnValue(false);

    render(<ChatConversationPanel />);
    await user.click(screen.getByTestId("session-conversation-area"));

    expect(mocks.goToSession).not.toHaveBeenCalled();
  });
});
