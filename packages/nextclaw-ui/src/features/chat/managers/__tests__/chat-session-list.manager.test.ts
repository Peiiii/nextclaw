import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from '@tanstack/react-query';
import { NextClawClientError } from '@nextclaw/client-sdk';
import type * as SharedApi from "@/shared/lib/api";
import { ChatSessionListManager } from "@/features/chat/managers/chat-session-list.manager";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";

const chatSessionListModeStorageKey = "nextclaw.chat.session-list.mode";
const persistStorage = new Map<string, unknown>();

function createLocalStoragePersistStorage() {
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

const mocks = vi.hoisted(() => ({
  updateNcpSession: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

vi.mock("@/shared/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    updateNcpSession: mocks.updateNcpSession,
  };
});

function resetChatSessionListManagerState() {
  persistStorage.clear();
  useChatSessionListStore.persist.setOptions({
    storage: createLocalStoragePersistStorage() as never,
  });
  useChatThreadStore.persist.setOptions({
    storage: createLocalStoragePersistStorage() as never,
  });
  mocks.updateNcpSession.mockReset();
  mocks.updateNcpSession.mockResolvedValue({});
  mocks.toastError.mockReset();
  useChatSessionListStore.setState({
    optimisticReadAtBySessionKey: {},
    optimisticPinnedBySessionKey: {},
    snapshot: {
      ...useChatSessionListStore.getState().snapshot,
      selectedSessionKey: "session-1",
      listMode: "time-first",
      pinnedSessionKeys: [],
      pinnedProjectRoots: [],
      collapsedProjectRoots: [],
    },
  });
  useChatThreadStore.setState({
    snapshot: {
      ...useChatThreadStore.getState().snapshot,
      draftProjectRoot: null,
      workspacePanelParentKey: "session-1",
      activeWorkspacePanelKind: "child-session",
      activeChildSessionKey: "child-session-1",
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [
        { kind: "child-session", key: "child-session-1" },
      ],
      workspaceNavigationHistoryIndex: 0,
    },
  });
}

describe("ChatSessionListManager draft and selection flow", () => {
  beforeEach(resetChatSessionListManagerState);

  it("clears the route-derived session selection outside session routes", () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0],
    );

    manager.syncRouteSessionSelection(null);

    expect(
      useChatSessionListStore.getState().snapshot.selectedSessionKey,
    ).toBeNull();
  });

  it("applies the requested session type when creating a session", () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.createSession({ sessionType: "codex" });

    expect(uiManager.navigateTo).toHaveBeenCalledWith("/chat/draft", {
      replace: true,
      state: {
        chatDraft: {
          sessionType: "codex",
          projectRoot: null,
          prompt: null,
        },
      },
    });
    expect(
      useChatSessionListStore.getState().snapshot.selectedSessionKey,
    ).toBe("session-1");
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
    expect(
      useChatThreadStore.getState().snapshot.hasSubmittedDraftMessage,
    ).toBe(false);
  });

  it("starts an agent draft chat through one owner state transition", () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.startAgentDraftChat("researcher", "codex", "Create an agent");

    expect(uiManager.navigateTo).toHaveBeenCalledWith("/chat/draft", {
      replace: true,
      state: {
        chatDraft: {
          sessionType: "codex",
          projectRoot: null,
          prompt: "Create an agent",
        },
      },
    });
    expect(useChatSessionListStore.getState().snapshot.selectedAgentId).toBe(
      "researcher",
    );
    expect(
      useChatSessionListStore.getState().snapshot.selectedSessionKey,
    ).toBe("session-1");
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
    expect(
      useChatThreadStore.getState().snapshot.hasSubmittedDraftMessage,
    ).toBe(false);
  });

  it("hydrates the draft project root when creating a session inside a project group", () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.createSession({
      projectRoot: "/tmp/project-alpha",
      sessionType: "native",
    });

    expect(uiManager.navigateTo).toHaveBeenCalledWith("/chat/draft", {
      replace: true,
      state: {
        chatDraft: {
          sessionType: "native",
          projectRoot: "/tmp/project-alpha",
          prompt: null,
        },
      },
    });
    expect(useChatThreadStore.getState().snapshot.draftProjectRoot).toBe(
      "/tmp/project-alpha",
    );
  });

  it("drops file tabs from an abandoned draft while preserving real session tabs", () => {
    useChatThreadStore.getState().setSnapshot({
      workspaceFileTabs: [
        {
          key: "draft::preview::old.md",
          parentSessionKey: null,
          path: "old.md",
          viewMode: "preview",
        },
        {
          key: "session-1::preview::kept.md",
          parentSessionKey: "session-1",
          path: "kept.md",
          viewMode: "preview",
        },
      ],
    });
    const manager = new ChatSessionListManager({
      navigateTo: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0]);

    manager.createSession({ projectRoot: "/tmp/new-project" });

    expect(useChatThreadStore.getState().snapshot.workspaceFileTabs).toEqual([
      expect.objectContaining({
        key: "session-1::preview::kept.md",
        parentSessionKey: "session-1",
      }),
    ]);
  });

  it("carries an initial prompt through the draft route state", () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => false),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.createSession({ prompt: "  每天整理项目风险  " });

    expect(uiManager.navigateTo).toHaveBeenCalledWith("/chat/draft", {
      replace: false,
      state: {
        chatDraft: {
          sessionType: "native",
          projectRoot: null,
          prompt: "每天整理项目风险",
        },
      },
    });
  });

  it("keeps a project-bound initial prompt as an editable unsent draft", () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.createSession({
      projectRoot: "/tmp/project-alpha",
      prompt: "Use the project observation capability.",
    });

    expect(uiManager.navigateTo).toHaveBeenCalledWith("/chat/draft", {
      replace: true,
      state: {
        chatDraft: {
          sessionType: "native",
          projectRoot: "/tmp/project-alpha",
          prompt: "Use the project observation capability.",
        },
      },
    });
    expect(useChatThreadStore.getState().snapshot.hasSubmittedDraftMessage).toBe(false);
  });

  it("does not eagerly replace the old selected session before the route finishes switching", () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.createSession({
      projectRoot: "/tmp/project-alpha",
      sessionType: "native",
    });

    expect(
      useChatSessionListStore.getState().snapshot.selectedSessionKey,
    ).toBe("session-1");
    expect(uiManager.navigateTo).toHaveBeenCalledWith(
      "/chat/draft",
      expect.any(Object),
    );
  });

  it("delegates existing-session selection to routing while preserving workspace panel state", () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.selectSession("session-2");

    expect(uiManager.goToSession).toHaveBeenCalledWith("session-2");
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe(
      "session-1",
    );
    expect(useChatThreadStore.getState().snapshot.workspacePanelParentKey).toBe(
      "session-1",
    );
    expect(
      useChatThreadStore.getState().snapshot.activeWorkspacePanelKind,
    ).toBe("child-session");
    expect(useChatThreadStore.getState().snapshot.activeChildSessionKey).toBe(
      "child-session-1",
    );
    expect(
      useChatThreadStore.getState().snapshot.activeWorkspaceFileKey,
    ).toBeNull();
  });
});

describe("ChatSessionListManager list preference and read state", () => {
  beforeEach(resetChatSessionListManagerState);

  it.each(['project-first', 'scheduled'] as const)("persists %s without touching other session list state", (mode) => {
    const uiManager = {} as ConstructorParameters<
      typeof ChatSessionListManager
    >[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.setListMode(mode);

    expect(useChatSessionListStore.getState().snapshot.listMode).toBe(
      mode,
    );
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe(
      "session-1",
    );
    expect(persistStorage.get(chatSessionListModeStorageKey)).toMatchObject({
      state: {
        snapshot: {
          listMode: mode,
        },
      },
    });
  });

  it("persists project list preferences through the list owner", () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0],
    );

    manager.toggleProjectPinned("/tmp/project-alpha");
    manager.toggleProjectCollapsed("/tmp/project-alpha");

    expect(useChatSessionListStore.getState().snapshot).toMatchObject({
      pinnedSessionKeys: [],
      pinnedProjectRoots: ["/tmp/project-alpha"],
      collapsedProjectRoots: ["/tmp/project-alpha"],
    });
    expect(persistStorage.get(chatSessionListModeStorageKey)).toMatchObject({
      state: {
        snapshot: {
          pinnedSessionKeys: [],
          pinnedProjectRoots: ["/tmp/project-alpha"],
          collapsedProjectRoots: ["/tmp/project-alpha"],
        },
      },
    });
  });

  it('persists a pin, updates server queries and keeps optimistic state out of browser storage', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['ncp-session-pages', 100, null], {
      pages: [{ sessions: [{ sessionId: 'session-2', updatedAt: '2026-10-02', metadata: {} }], total: 1 }],
      pageParams: [1],
    });
    const manager = new ChatSessionListManager({} as never, queryClient);
    let complete!: (value: unknown) => void;
    mocks.updateNcpSession.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const pending = manager.toggleSessionPinned('session-2', false);
    await Promise.resolve();
    expect(useChatSessionListStore.getState().optimisticPinnedBySessionKey).toEqual({ 'session-2': true });
    await manager.toggleSessionPinned('session-2', true);
    expect(mocks.updateNcpSession).toHaveBeenCalledOnce();
    expect(mocks.updateNcpSession).toHaveBeenCalledWith('session-2', { pinned: true });
    complete({ sessionId: 'session-2', updatedAt: '2026-10-02', metadata: { pinned: true } });
    await pending;
    expect(queryClient.getQueryData(['ncp-session-pages', 100, null])).toMatchObject({
      pages: [{ sessions: [{ metadata: { pinned: true } }] }],
    });
    expect(useChatSessionListStore.getState().optimisticPinnedBySessionKey).toEqual({});
    expect(persistStorage.get(chatSessionListModeStorageKey)).toMatchObject({ state: { snapshot: { pinnedSessionKeys: [] } } });
  });

  it('rolls back a failed pin and allows retry', async () => {
    const manager = new ChatSessionListManager({} as never, new QueryClient());
    mocks.updateNcpSession.mockRejectedValueOnce(new Error('offline'));
    await manager.toggleSessionPinned('session-2', true);
    expect(useChatSessionListStore.getState().optimisticPinnedBySessionKey).toEqual({});
    expect(mocks.toastError).toHaveBeenCalledOnce();
    mocks.updateNcpSession.mockResolvedValue({ sessionId: 'session-2', updatedAt: '2026-10-02', metadata: { pinned: false } });
    await manager.toggleSessionPinned('session-2', true);
    expect(mocks.updateNcpSession).toHaveBeenLastCalledWith('session-2', { pinned: false });
  });

  it('migrates old pins outside loaded pages while respecting server false and retaining network failures', async () => {
    useChatSessionListStore.getState().setSnapshot({ pinnedSessionKeys: ['old', 'unpin', 'gone', 'offline'] });
    mocks.updateNcpSession.mockImplementation(async (id: string) => {
      if (id === 'gone') throw new NextClawClientError({ message: 'not found', status: 404 });
      if (id === 'offline') throw new Error('offline');
      return { sessionId: id, metadata: id === 'unpin' ? { pinned: false } : {} };
    });
    const manager = new ChatSessionListManager({} as never, new QueryClient());
    await manager.migrateLegacySessionPins();
    expect(mocks.updateNcpSession).toHaveBeenCalledWith('old', { pinned: true, pinnedIfUnset: true });
    expect(mocks.updateNcpSession).toHaveBeenCalledWith('unpin', { pinned: true, pinnedIfUnset: true });
    expect(useChatSessionListStore.getState().snapshot.pinnedSessionKeys).toEqual(['offline']);
    expect(mocks.toastError).toHaveBeenCalledOnce();
    mocks.updateNcpSession.mockResolvedValue({ sessionId: 'offline', metadata: {} });
    await manager.migrateLegacySessionPins();
    expect(useChatSessionListStore.getState().snapshot.pinnedSessionKeys).toEqual([]);
  });

  it("marks a session as read through the session list owner boundary", () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0],
    );

    manager.markSessionRead("session-2", "2026-04-10T10:00:00.000Z");

    expect(
      useChatSessionListStore.getState().optimisticReadAtBySessionKey[
        "session-2"
      ],
    ).toBe("2026-04-10T10:00:00.000Z");
    expect(mocks.updateNcpSession).toHaveBeenCalledWith("session-2", {
      uiReadAt: "2026-04-10T10:00:00.000Z",
    });
  });

  it("skips persisting read state when the backend already has the same watermark", () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0],
    );

    manager.markSessionRead(
      "session-2",
      "2026-04-10T10:00:00.000Z",
      "2026-04-10T10:00:00.000Z",
    );

    expect(
      useChatSessionListStore.getState().optimisticReadAtBySessionKey[
        "session-2"
      ],
    ).toBeUndefined();
    expect(mocks.updateNcpSession).not.toHaveBeenCalled();
  });

  it("marks a visible workspace child session as read through the session list owner", () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0],
    );

    manager.markVisibleWorkspaceChildRead({
      sessionKey: "child-session-1",
      lastMessageAt: "2026-04-10T10:00:00.000Z",
      readAt: null,
      runStatus: "completed",
    });

    expect(
      useChatSessionListStore.getState().optimisticReadAtBySessionKey[
        "child-session-1"
      ],
    ).toBe("2026-04-10T10:00:00.000Z");
    expect(mocks.updateNcpSession).toHaveBeenCalledWith("child-session-1", {
      uiReadAt: "2026-04-10T10:00:00.000Z",
    });
  });

  it("keeps running workspace child sessions unread until they settle", () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0],
    );

    manager.markVisibleWorkspaceChildRead({
      sessionKey: "child-session-1",
      lastMessageAt: "2026-04-10T10:00:00.000Z",
      readAt: null,
      runStatus: "running",
    });

    expect(
      useChatSessionListStore.getState().optimisticReadAtBySessionKey[
        "child-session-1"
      ],
    ).toBeUndefined();
    expect(mocks.updateNcpSession).not.toHaveBeenCalled();
  });
});

describe("ChatSessionListStore persistence", () => {
  beforeEach(() => {
    persistStorage.clear();
    useChatSessionListStore.persist.setOptions({
      storage: createLocalStoragePersistStorage() as never,
    });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: "time-first",
        pinnedSessionKeys: [],
        pinnedProjectRoots: [],
        collapsedProjectRoots: [],
      },
    });
  });

  it('restores the scheduled view after rehydration', () => {
    useChatSessionListStore.persist.setOptions({ storage: {
      getItem: () => ({ state: { snapshot: { listMode: 'scheduled' } } }),
      setItem: vi.fn(), removeItem: vi.fn(),
    } });
    useChatSessionListStore.persist.rehydrate();
    expect(useChatSessionListStore.getState().snapshot.listMode).toBe('scheduled');
  });

  it("falls back to time-first when the persisted sidebar list mode is invalid", () => {
    useChatSessionListStore.persist.setOptions({
      storage: {
        getItem: () => ({ state: { snapshot: { listMode: "sideways" } } }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    useChatSessionListStore.persist.rehydrate();

    expect(useChatSessionListStore.getState().snapshot.listMode).toBe(
      "time-first",
    );
  });
});
