import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ChatPageLayout,
  type ChatPageProps,
  useChatSessionSync,
} from "@/features/chat/components/layout/chat-page-shell";
import { parseSessionKeyFromRoute } from "@/features/chat/features/session/utils/chat-session-route.utils";
import { ChatPresenter } from "@/features/chat/presenters/chat.presenter";
import {
  isNcpAgentStartupUnavailableErrorMessage,
  useNcpSessionConversation,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-conversation";
import {
  useNcpChatSelectedSession,
} from "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state";
import { useChatQueryStoreSync } from "@/features/chat/features/ncp/hooks/use-ncp-chat-query-store-sync";
import {
  ChatPresenterProvider,
  usePresenter,
} from "@/features/chat/components/providers/chat-presenter.provider";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { useSystemStatus } from "@/features/system-status";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { isNcpChatRuntimeBlocked, resolveNcpChatSendErrorMessage } from "@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils";
import { useUiShowContentEvent } from "@/features/chat/features/ncp/hooks/use-ui-show-content-event";
import { readNcpContextWindowValue } from "@/features/chat/features/session/utils/ncp-session-context-metadata.utils";

function useChatDraftIntentConsumer() {
  const appPresenter = useAppPresenter();
  const presenter = usePresenter();
  useEffect(() => {
    const applyIntent = (intent: { id: number; prompt: string }) => {
      presenter.startAgentCreationDraft(intent.prompt);
      appPresenter.chatDraftIntentManager.markConsumed(intent.id);
    };
    const unsubscribe = appPresenter.chatDraftIntentManager.subscribe(applyIntent);
    const pendingIntent = appPresenter.chatDraftIntentManager.consumePending();
    if (pendingIntent) {
      applyIntent(pendingIntent);
    }
    return unsubscribe;
  }, [appPresenter, presenter]);
}

function useNcpChatRouteSelection() {
  const { sessionId: routeSessionIdParam } = useParams<{ sessionId?: string }>();
  const routeSessionKey = useMemo(
    () => parseSessionKeyFromRoute(routeSessionIdParam),
    [routeSessionIdParam],
  );
  return {
    routeSessionKey,
    sessionKey: routeSessionKey ?? undefined,
  };
}

type NcpChatConversation = ReturnType<typeof useNcpSessionConversation>;

function useChatRunRuntimeConnection(params: {
  agent: NcpChatConversation;
  sessionKey: string | undefined;
}) {
  const presenter = usePresenter();
  const { agent, sessionKey } = params;
  useEffect(() => {
    presenter.chatRunManager.setActiveRuntime({
      sessionKey: sessionKey ?? null,
      sendEnvelope: (envelope) => agent.send(envelope),
      abortCurrentRun: () => agent.abort(),
      resumeCurrentSessionRun: () => agent.streamRun(),
    });
    return () => {
      presenter.chatRunManager.setActiveRuntime(null);
    };
  }, [
    agent,
    presenter,
    sessionKey,
  ]);
}

function useNcpChatUiBindings() {
  const presenter = usePresenter();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    presenter.chatUiManager.syncState({
      pathname: location.pathname,
    });
    presenter.chatUiManager.bindActions({
      navigate,
      confirm,
    });
  }, [confirm, location.pathname, navigate, presenter]);
  return <ConfirmDialog />;
}

function useChatRunSnapshotSync(params: {
  agent: NcpChatConversation;
  isSending: boolean;
  isRunning: boolean;
  lastSendError: string | null;
  routeSessionKey: string | null;
}) {
  const presenter = usePresenter();
  const { agent, isRunning, isSending, lastSendError, routeSessionKey } = params;
  useEffect(() => {
    presenter.chatRunManager.applyRunSnapshot({
      routeSessionKey,
      isHydrating: agent.isHydrating,
      isSending,
      isRunning,
      visibleMessages: agent.visibleMessages,
      contextWindow: readNcpContextWindowValue(agent.snapshot.contextWindow),
      sendErrorMessage: lastSendError,
      materializedSessionKey:
        agent.snapshot.activeRun?.sessionId ??
        agent.visibleMessages.find((message) => message.sessionId.trim())?.sessionId ??
        null,
    });
  }, [
    agent.isHydrating,
    agent.snapshot.activeRun?.sessionId,
    agent.snapshot.contextWindow,
    agent.visibleMessages,
    isRunning,
    isSending,
    lastSendError,
    presenter,
    routeSessionKey,
  ]);
}

export function NcpChatPage({ view }: ChatPageProps) {
  const appPresenter = useAppPresenter();
  const [presenter] = useState(() => new ChatPresenter(appPresenter));
  return (
    <ChatPresenterProvider presenter={presenter}>
      <NcpChatPageContent view={view} />
    </ChatPresenterProvider>
  );
}

function NcpChatPageContent({ view }: ChatPageProps) {
  const presenter = usePresenter();
  const systemStatus = useSystemStatus();
  const isRuntimeBlocked = isNcpChatRuntimeBlocked(systemStatus);
  const confirmDialog = useNcpChatUiBindings();
  const routeSelection = useNcpChatRouteSelection();
  const { routeSessionKey, sessionKey } = routeSelection;
  useChatQueryStoreSync({
    sessionKey: sessionKey ?? null,
  });
  const selectedSession = useNcpChatSelectedSession(sessionKey ?? null);
  const agent = useNcpSessionConversation(sessionKey);
  const rawLastSendError =
    agent.hydrateError?.message ?? agent.snapshot.error?.message ?? null;
  const filteredLastSendError =
    systemStatus.phase === "ready" &&
    isNcpAgentStartupUnavailableErrorMessage(rawLastSendError)
      ? null
      : rawLastSendError;
  const currentSessionRunning = agent.isRunning || selectedSession?.status === "running";
  const isSending = agent.isSending || currentSessionRunning;
  const lastSendError =
    isRuntimeBlocked
      ? null
      : systemStatus.phase === "ready"
      ? filteredLastSendError
      : resolveNcpChatSendErrorMessage({
          message: filteredLastSendError,
          status: systemStatus,
        });
  useChatRunRuntimeConnection({
    agent,
    sessionKey,
  });
  useChatSessionSync({
    view,
    routeSessionKey,
    syncRouteSessionSelection:
      presenter.chatSessionListManager.syncRouteSessionSelection,
  });
  useChatDraftIntentConsumer();
  useUiShowContentEvent();
  useChatRunSnapshotSync({
    agent,
    isRunning: currentSessionRunning,
    routeSessionKey,
    lastSendError,
    isSending,
  });
  return <ChatPageLayout view={view} confirmDialog={confirmDialog} />;
}
