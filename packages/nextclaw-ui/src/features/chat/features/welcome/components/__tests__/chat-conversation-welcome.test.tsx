import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatConversationWelcome } from "@/features/chat/features/welcome/components/chat-conversation-welcome";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import type { ChatQuerySnapshot } from "@/features/chat/stores/ncp-chat-query.store";

const mocks = vi.hoisted(() => ({
  setSelectedAgentId: vi.fn(),
  applyPromptSuggestion: vi.fn(),
  setPendingProjectRoot: vi.fn(),
  setPendingSessionType: vi.fn(),
  agents: [
    { id: "main", displayName: "Main", runtime: "native" },
    { id: "engineer", displayName: "Engineer", runtime: "codex" },
  ],
}));

vi.mock("@/features/chat/features/welcome/components/chat-welcome", () => ({
  ChatWelcome: ({
    inputSlot,
    onSelectAgent,
    onSelectPrompt,
    onSelectProjectRoot,
    onSelectSessionType,
  }: {
    inputSlot: ReactNode;
    onSelectAgent: (agentId: string) => void;
    onSelectPrompt: (prompt: string) => void;
    onSelectProjectRoot: (projectRoot: string) => void;
    onSelectSessionType: (sessionType: string) => void;
  }) => (
    <div>
      {inputSlot}
      <button type="button" onClick={() => onSelectAgent("engineer")}>
        switch draft agent
      </button>
      <button type="button" onClick={() => onSelectPrompt("example prompt")}>
        pick prompt
      </button>
      <button type="button" onClick={() => onSelectSessionType("codex")}>
        switch session type
      </button>
      <button
        type="button"
        onClick={() => onSelectProjectRoot("/tmp/project-alpha")}
      >
        select draft project
      </button>
    </div>
  ),
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatSessionListManager: {
      setSelectedAgentId: mocks.setSelectedAgentId,
    },
    chatInputManager: {
      applyPromptSuggestion: mocks.applyPromptSuggestion,
      setPendingProjectRoot: mocks.setPendingProjectRoot,
      setPendingSessionType: mocks.setPendingSessionType,
    },
  }),
}));

vi.mock("@/shared/hooks/use-agents", () => ({
  useAgents: () => ({
    data: { agents: mocks.agents },
  }),
}));

function createFetchedQuery<TData>(data: TData) {
  return {
    data,
    error: null,
    fetchStatus: "idle",
    isFetched: true,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    status: "success",
  };
}

function resetWelcomeTestState() {
  mocks.setSelectedAgentId.mockReset();
  mocks.applyPromptSuggestion.mockReset();
  mocks.setPendingProjectRoot.mockReset();
  mocks.setPendingSessionType.mockReset();
  useChatInputStore.setState({
    snapshot: {
      ...useChatInputStore.getState().snapshot,
      defaultSessionType: "native",
      pendingSessionType: "native",
      selectedSessionType: undefined,
      pendingProjectRoot: null,
    },
  });
  useChatSessionListStore.setState({
    snapshot: {
      ...useChatSessionListStore.getState().snapshot,
      selectedAgentId: "main",
    },
  });
  useChatThreadStore.setState({
    snapshot: {
      ...useChatThreadStore.getState().snapshot,
      agentId: null,
    },
  });
  useChatQueryStore.setState({
    snapshot: {
      configQuery: createFetchedQuery({
        agents: {
          defaults: {
            workspace: "/Users/demo/.nextclaw/workspace",
          },
        },
        providers: {},
      }) as unknown as ChatQuerySnapshot["configQuery"],
      sessionTypesQuery: createFetchedQuery({
        defaultType: "native",
        options: [
          { value: "native", label: "Native", ready: true },
          { value: "codex", label: "Codex", ready: true },
        ],
      }) as unknown as ChatQuerySnapshot["sessionTypesQuery"],
      sessionsQuery: createFetchedQuery({
        sessions: [],
        total: 0,
      }) as unknown as ChatQuerySnapshot["sessionsQuery"],
    },
  });
}

describe("ChatConversationWelcome", () => {
  beforeEach(resetWelcomeTestState);

  it("stores the selected welcome project through the input manager", async () => {
    const user = userEvent.setup();

    render(<ChatConversationWelcome inputSlot={<div data-testid="input-slot" />} />);

    await user.click(
      screen.getByRole("button", { name: "select draft project" }),
    );

    expect(mocks.setPendingProjectRoot).toHaveBeenCalledWith("/tmp/project-alpha");
  });

  it("applies a selected prompt suggestion through the input manager", async () => {
    const user = userEvent.setup();

    render(<ChatConversationWelcome inputSlot={<div data-testid="input-slot" />} />);

    await user.click(
      screen.getByRole("button", { name: "pick prompt" }),
    );

    expect(mocks.applyPromptSuggestion).toHaveBeenCalledWith("example prompt");
  });


  it("syncs the pending session type when switching the draft agent", async () => {
    const user = userEvent.setup();

    render(<ChatConversationWelcome inputSlot={<div data-testid="input-slot" />} />);

    await user.click(
      screen.getByRole("button", { name: "switch draft agent" }),
    );

    expect(mocks.setSelectedAgentId).toHaveBeenCalledWith("engineer");
    expect(mocks.setPendingSessionType).toHaveBeenCalledWith("codex");
  });

  it("stores an explicit welcome session type selection", async () => {
    const user = userEvent.setup();

    render(<ChatConversationWelcome inputSlot={<div data-testid="input-slot" />} />);

    await user.click(
      screen.getByRole("button", { name: "switch session type" }),
    );

    expect(mocks.setPendingSessionType).toHaveBeenCalledWith("codex");
  });
});
