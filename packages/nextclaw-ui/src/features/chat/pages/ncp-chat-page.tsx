import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildNcpRequestEnvelope,
} from "@nextclaw/ncp-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ChatPageLayout,
  type ChatPageProps,
  useChatSessionSync,
} from "@/features/chat/components/layout/chat-page-shell";
import { parseSessionKeyFromRoute } from "@/features/chat/features/session/utils/chat-session-route.utils";
import { NcpChatPresenter } from "@/features/chat/managers/ncp-chat-presenter.manager";
import {
  isNcpAgentStartupUnavailableErrorMessage,
  useNcpSessionConversation,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-conversation";
import {
  useNcpChatSelectedSession,
  useNcpChatSnapshotSync,
} from "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state";
import { useNcpChatQueryStoreSync } from "@/features/chat/features/ncp/hooks/use-ncp-chat-query-store-sync";
import {
  ChatPresenterProvider,
  usePresenter,
} from "@/features/chat/components/providers/chat-presenter.provider";
import type { ResumeRunParams } from "@/features/chat/types/chat-stream.types";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { useSystemStatus } from "@/features/system-status";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { isNcpChatRuntimeBlocked, resolveNcpChatSendErrorMessage } from "@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils";
import {
  buildNcpSendMetadata,
} from "@/features/chat/features/session/utils/ncp-chat-send-metadata.utils";
import { useUiShowContentEvent } from "@/features/chat/features/ncp/hooks/use-ui-show-content-event";

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
type NcpChatSelectedSession = ReturnType<typeof useNcpChatSelectedSession>;

function useNcpChatStreamBindings(params: {
  agent: NcpChatConversation;
  selectedSession: NcpChatSelectedSession;
  sessionKey: string | undefined;
}) {
  const presenter = usePresenter();
  const {
    agent,
    selectedSession,
    sessionKey,
  } = params;
  useEffect(() => {
    presenter.chatStreamActionsManager.bind({
      sendMessage: async (payload) => {
        if ((payload.sessionKey ?? null) !== (sessionKey ?? null)) {
          return;
        }
        const metadata = buildNcpSendMetadata({
          agentId: payload.agentId,
          model: payload.model,
          thinkingLevel: payload.thinkingLevel,
          sessionType: payload.sessionType,
          projectRoot: presenter.chatInputManager.resolveProjectRootForSend({
            sessionKey: payload.sessionKey ?? null,
            selectedSessionProjectRoot: selectedSession?.projectRoot ?? null,
          }),
          requestedSkills: payload.requestedSkills,
          composerNodes: payload.composerNodes,
        });
        const envelope = buildNcpRequestEnvelope({
          sessionId: payload.sessionKey,
          text: payload.message,
          attachments: payload.attachments,
          parts: payload.parts,
          metadata,
        });
        if (!envelope) {
          return;
        }
        try {
          const handle = await agent.send(envelope);
          if (!payload.sessionKey && handle?.sessionId) {
            presenter.chatSessionListManager.materializeRootSessionRoute(handle.sessionId);
          }
        } catch (error) {
          if (payload.restoreDraftOnError) {
            if (payload.composerNodes && payload.composerNodes.length > 0) {
              presenter.chatInputManager.restoreComposerState?.(
                payload.composerNodes,
                payload.attachments ?? [],
              );
            } else {
              presenter.chatInputManager.setDraft((currentDraft) =>
                currentDraft.trim().length === 0
                  ? payload.message
                  : currentDraft,
              );
            }
          }
          throw error;
        }
      },
      stopCurrentRun: async () => {
        await agent.abort();
      },
      resumeRun: async (run: ResumeRunParams) => {
        if (run.sessionKey !== sessionKey) {
          return;
        }
        await agent.streamRun();
      },
      applyHistoryMessages: () => {},
    });
  }, [
    agent,
    presenter,
    selectedSession?.projectRoot,
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

function useMaterializedRootSessionRouteSync(
  params: {
    agent: NcpChatConversation;
    routeSessionKey: string | null;
  },
) {
  const presenter = usePresenter();
  const { agent, routeSessionKey } = params;
  const materializedSessionKey =
    agent.snapshot.activeRun?.sessionId ??
    agent.visibleMessages.find((message) => message.sessionId.trim())?.sessionId ??
    null;
  useEffect(() => {
    if (routeSessionKey || !materializedSessionKey) {
      return;
    }
    presenter.chatSessionListManager.materializeRootSessionRoute(materializedSessionKey);
  }, [materializedSessionKey, presenter, routeSessionKey]);
}

export function NcpChatPage({ view }: ChatPageProps) {
  const appPresenter = useAppPresenter();
  const [presenter] = useState(() => new NcpChatPresenter(appPresenter));
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
  useNcpChatQueryStoreSync({
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
  useNcpChatStreamBindings({
    agent,
    selectedSession,
    sessionKey,
  });
  useMaterializedRootSessionRouteSync({
    agent,
    routeSessionKey,
  });
  useChatSessionSync({
    view,
    routeSessionKey,
    syncRouteSessionSelection:
      presenter.chatSessionListManager.syncRouteSessionSelection,
  });
  useUiShowContentEvent();
  useNcpChatSnapshotSync({
    canStopCurrentRun: currentSessionRunning,
    lastSendError,
    isSending,
    agent,
  });
  return <ChatPageLayout view={view} confirmDialog={confirmDialog} />;
}
