import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import type { ChatUiManager } from "@/features/chat/managers/chat-ui.manager";
import type { SetStateAction } from "react";
import { normalizeSessionProjectRootValue } from "@/shared/lib/session-project";
import { updateNcpSession } from "@/shared/lib/api";
import { CHAT_DRAFT_SESSION_PATH } from "@/features/chat/features/session/utils/chat-session-route.utils";
import {
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";

type WorkspaceChildReadState = {
  sessionKey: string | null | undefined;
  lastMessageAt?: string | null;
  readAt?: string | null;
  runStatus?: string | null;
};

export type CreateChatSessionOptions = {
  readonly projectRoot?: string | null;
  readonly prompt?: string | null;
  readonly sessionType?: string;
};

function toggleListValue(values: string[], value: string): string[] {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return values;
  }
  return values.includes(normalizedValue)
    ? values.filter((item) => item !== normalizedValue)
    : [normalizedValue, ...values];
}

export class ChatSessionListManager {
  constructor(private uiManager: ChatUiManager) {}

  private syncDraftThreadState = () => {
    useChatThreadStore.getState().setSnapshot({
      sessionKey: null,
      sessionDisplayName: undefined,
      canDeleteSession: false,
      parentSessionKey: null,
      parentSessionLabel: null,
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
      activeWorkspaceFileKey: null,
      closedWorkspaceTabEntries: [],
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
    });
  };

  private resolveUpdateValue = <T>(prev: T, next: SetStateAction<T>): T => {
    if (typeof next === "function") {
      return (next as (value: T) => T)(prev);
    }
    return next;
  };
  private shouldPersistReadAt = (
    sessionKey: string,
    readAt: string,
    currentReadAt?: string | null,
  ): boolean => {
    const optimisticReadAt =
      useChatSessionListStore.getState().optimisticReadAtBySessionKey[
        sessionKey
      ];
    const effectiveCurrentReadAt =
      optimisticReadAt && currentReadAt
        ? optimisticReadAt.localeCompare(currentReadAt) > 0
          ? optimisticReadAt
          : currentReadAt
        : (optimisticReadAt ?? currentReadAt ?? undefined);
    if (!effectiveCurrentReadAt) {
      return true;
    }
    return readAt.localeCompare(effectiveCurrentReadAt) > 0;
  };

  setSelectedAgentId = (next: SetStateAction<string>) => {
    const prev = useChatSessionListStore.getState().snapshot.selectedAgentId;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatSessionListStore.getState().setSnapshot({ selectedAgentId: value });
  };

  syncSelectedSessionAgent = () => {
    const normalizedAgentId = useChatThreadStore
      .getState()
      .snapshot.agentId?.trim();
    if (!normalizedAgentId) {
      return;
    }
    this.setSelectedAgentId(normalizedAgentId);
  };

  setSelectedSessionKey = (next: SetStateAction<string | null>) => {
    const prev = useChatSessionListStore.getState().snapshot.selectedSessionKey;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatSessionListStore
      .getState()
      .setSnapshot({ selectedSessionKey: value });
  };

  syncRouteSessionSelection = (params: {
    isChatView: boolean;
    routeSessionKey: string | null;
  }) => {
    const { isChatView, routeSessionKey } = params;
    if (!isChatView) {
      return;
    }
    const { selectedSessionKey } = useChatSessionListStore.getState().snapshot;
    if (routeSessionKey) {
      if (selectedSessionKey !== routeSessionKey) {
        this.setSelectedSessionKey(routeSessionKey);
      }
      return;
    }
    if (selectedSessionKey !== null) {
      this.setSelectedSessionKey(null);
    }
  };

  setListMode = (next: SetStateAction<"time-first" | "project-first">) => {
    const prev = useChatSessionListStore.getState().snapshot.listMode;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatSessionListStore.getState().setSnapshot({ listMode: value });
  };

  toggleSessionPinned = (sessionKey: string) => {
    const { pinnedSessionKeys } = useChatSessionListStore.getState().snapshot;
    useChatSessionListStore.getState().setSnapshot({
      pinnedSessionKeys: toggleListValue(pinnedSessionKeys, sessionKey),
    });
  };

  toggleProjectPinned = (projectRoot: string) => {
    const { pinnedProjectRoots } = useChatSessionListStore.getState().snapshot;
    useChatSessionListStore.getState().setSnapshot({
      pinnedProjectRoots: toggleListValue(pinnedProjectRoots, projectRoot),
    });
  };

  toggleProjectCollapsed = (projectRoot: string) => {
    const { collapsedProjectRoots } =
      useChatSessionListStore.getState().snapshot;
    useChatSessionListStore.getState().setSnapshot({
      collapsedProjectRoots: toggleListValue(
        collapsedProjectRoots,
        projectRoot,
      ),
    });
  };

  markSessionRead = (
    sessionKey: string | null | undefined,
    readAt: string | null | undefined,
    currentReadAt?: string | null,
  ) => {
    const normalizedSessionKey = sessionKey?.trim();
    const normalizedReadAt = readAt?.trim();
    if (!normalizedSessionKey || !normalizedReadAt) {
      return;
    }
    if (
      !this.shouldPersistReadAt(
        normalizedSessionKey,
        normalizedReadAt,
        currentReadAt,
      )
    ) {
      return;
    }
    useChatSessionListStore
      .getState()
      .markSessionRead(normalizedSessionKey, normalizedReadAt);
    void updateNcpSession(normalizedSessionKey, {
      uiReadAt: normalizedReadAt,
    }).catch(() => undefined);
  };

  markVisibleWorkspaceChildRead = (tab: WorkspaceChildReadState) => {
    this.markSessionRead(
      tab.sessionKey,
      tab.runStatus === "running" ? null : tab.lastMessageAt,
      tab.readAt,
    );
  };

  createSession = (options: CreateChatSessionOptions = {}): void => {
    const { projectRoot, prompt, sessionType } = options;
    const nextSessionType = normalizeSessionType(
      sessionType ?? DEFAULT_SESSION_TYPE,
    );
    const normalizedProjectRoot = normalizeSessionProjectRootValue(projectRoot);
    const normalizedPrompt = prompt?.trim() || null;
    useChatSessionListStore.getState().setSnapshot({
      selectedSessionKey: null,
    });
    this.syncDraftThreadState();
    this.uiManager.navigateTo(CHAT_DRAFT_SESSION_PATH, {
      replace: this.uiManager.isAtChatRoot(),
      state: {
        chatDraft: {
          sessionType: nextSessionType,
          projectRoot: normalizedProjectRoot,
          prompt: normalizedPrompt,
        },
      },
    });
  };

  startAgentDraftChat = (agentId: string, sessionType: string): void => {
    const normalizedAgentId = agentId.trim() || "main";
    this.createSession({ sessionType });
    this.setSelectedAgentId(normalizedAgentId);
  };

  selectSession = (sessionKey: string) => {
    this.uiManager.goToSession(sessionKey);
  };

  setQuery = (next: SetStateAction<string>) => {
    const prev = useChatSessionListStore.getState().snapshot.query;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatSessionListStore.getState().setSnapshot({ query: value });
  };
}
