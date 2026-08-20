import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { ChatConversationContent } from "@/features/chat/components/conversation/chat-conversation-content";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import {
  isNcpAgentStartupUnavailableErrorMessage,
  useNcpSessionConversation,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-conversation";
import {
  isNcpChatRuntimeBlocked,
  resolveNcpChatSendErrorMessage,
} from "@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils";
import { buildChatContextWindowIndicator } from "@/features/chat/features/session/utils/chat-context-window-indicator.utils";
import { readNcpContextWindowValue } from "@/features/chat/features/session/utils/ncp-session-context-metadata.utils";
import { ChatConversationWelcome } from "@/features/chat/features/welcome/components/chat-conversation-welcome";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useSystemStatus } from "@/features/system-status";
import { t } from "@/shared/lib/i18n";
import type { SystemObjectResolvedReference } from "@nextclaw/shared";
import { deriveChatComposerDraft } from "@/features/chat/features/input/utils/chat-composer-state.utils";
import { appendSystemObjectReferenceToken } from "@/features/chat/features/input/utils/chat-system-object-reference.utils";
import type { ChatDraftIntent } from "@/features/chat/managers/chat-draft-intent.manager";

import {
  useSessionConversationController,
  type SessionConversationMaterializationContext,
} from "@/features/chat/features/conversation/hooks/use-session-conversation-controller";
import { useSessionConversationInputQuery } from "@/features/chat/features/conversation/hooks/use-session-conversation-input-query";
import { useSessionConversationInputState } from "@/features/chat/features/conversation/hooks/use-session-conversation-input-state";
import { useSessionRunQueue } from "@/features/chat/features/conversation/hooks/use-session-run-queue";
import {
  SessionConversationInput,
  type SessionConversationInputController,
} from "./session-conversation-input";

type SessionConversationAreaProps = {
  readonly consumeDraftIntent?: boolean;
  readonly materializationContext?: SessionConversationMaterializationContext | null;
  readonly onSessionMaterialized?: (sessionKey: string) => void;
  readonly sessionKey: string | null;
  readonly showWelcomeForDraft?: boolean;
};

function useSessionConversationDraftIntent(params: {
  readonly consumeDraftIntent: boolean;
  readonly applyPromptSuggestion: (prompt: string) => void;
  readonly applySystemObjectReference: (reference: SystemObjectResolvedReference) => void;
}) {
  const { applyPromptSuggestion, applySystemObjectReference, consumeDraftIntent } = params;
  const appPresenter = useAppPresenter();
  const presenter = usePresenter();
  useEffect(() => {
    if (!consumeDraftIntent) {
      return undefined;
    }
    const applyIntent = (intent: ChatDraftIntent) => {
      presenter.chatSessionListManager.createSession();
      presenter.chatSessionListManager.setSelectedAgentId("main");
      if (intent.kind === 'prompt') {
        applyPromptSuggestion(intent.prompt);
      } else {
        applySystemObjectReference(intent.reference);
      }
      appPresenter.chatDraftIntentManager.markConsumed(intent.id);
    };
    const unsubscribe =
      appPresenter.chatDraftIntentManager.subscribe(applyIntent);
    const pendingIntent = appPresenter.chatDraftIntentManager.consumePending();
    if (pendingIntent) {
      applyIntent(pendingIntent);
    }
    return unsubscribe;
  }, [appPresenter, applyPromptSuggestion, applySystemObjectReference, consumeDraftIntent, presenter]);
}

type ChatDraftRouteState = {
  readonly sessionType?: unknown;
  readonly projectRoot?: unknown;
  readonly prompt?: unknown;
};

function readChatDraftRouteState(value: unknown): ChatDraftRouteState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const draft = (value as { chatDraft?: unknown }).chatDraft;
  if (!draft || typeof draft !== "object") {
    return null;
  }
  return draft as ChatDraftRouteState;
}

function useSessionConversationDraftRouteState(params: {
  readonly applyPromptSuggestion: (prompt: string) => void;
  readonly sessionKey: string | null;
  readonly setPendingProjectRoot: (projectRoot: string | null) => void;
  readonly setPendingSessionType: (sessionType: string) => void;
}) {
  const {
    applyPromptSuggestion,
    sessionKey,
    setPendingProjectRoot,
    setPendingSessionType,
  } = params;
  const location = useLocation();
  const appliedRouteStateKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionKey) {
      return;
    }
    const draftState = readChatDraftRouteState(location.state);
    if (!draftState) {
      return;
    }
    const signature = [
      location.key,
      typeof draftState.sessionType === "string" ? draftState.sessionType : "",
      typeof draftState.projectRoot === "string" ? draftState.projectRoot : "",
      typeof draftState.prompt === "string" ? draftState.prompt : "",
    ].join(":");
    if (appliedRouteStateKeyRef.current === signature) {
      return;
    }
    appliedRouteStateKeyRef.current = signature;
    if (
      typeof draftState.sessionType === "string" &&
      draftState.sessionType.trim()
    ) {
      setPendingSessionType(draftState.sessionType);
    }
    if (typeof draftState.prompt === "string" && draftState.prompt.trim()) {
      applyPromptSuggestion(draftState.prompt);
    }
    setPendingProjectRoot(
      typeof draftState.projectRoot === "string" &&
        draftState.projectRoot.trim()
        ? draftState.projectRoot
        : null,
    );
  }, [
    applyPromptSuggestion,
    location.key,
    location.state,
    sessionKey,
    setPendingProjectRoot,
    setPendingSessionType,
  ]);
}

function SessionConversationAlerts({
  inputQuery,
}: {
  readonly inputQuery: ReturnType<typeof useSessionConversationInputQuery>;
}) {
  const presenter = usePresenter();
  const shouldShowProviderHint =
    inputQuery.isProviderStateResolved && inputQuery.modelOptions.length === 0;
  const sessionTypeUnavailableMessage =
    inputQuery.sessionTypeState.sessionTypeUnavailableMessage?.trim() || null;

  return (
    <>
      {shouldShowProviderHint ? (
        <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 flex items-center justify-between gap-3 shrink-0 sm:px-5">
          <span className="text-xs text-amber-800">
            {t("chatModelNoOptions")}
          </span>
          <button
            type="button"
            onClick={presenter.chatUiManager.goToProviders}
            className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            {t("chatGoConfigureProvider")}
          </button>
        </div>
      ) : null}
      {inputQuery.sessionTypeState.sessionTypeUnavailable &&
      sessionTypeUnavailableMessage ? (
        <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 shrink-0 sm:px-5">
          <span className="text-xs text-amber-800">
            {sessionTypeUnavailableMessage}
          </span>
        </div>
      ) : null}
    </>
  );
}

export function SessionConversationArea(props: SessionConversationAreaProps) {
  const {
    consumeDraftIntent = false,
    materializationContext = null,
    onSessionMaterialized,
    sessionKey,
    showWelcomeForDraft = true,
  } = props;
  const location = useLocation();
  const draftRouteState = sessionKey
    ? null
    : readChatDraftRouteState(location.state);
  const initialPrompt = typeof draftRouteState?.prompt === "string"
    ? draftRouteState.prompt
    : null;
  const systemStatus = useSystemStatus();
  const selectedAgentId = useChatSessionListStore(
    (state) => state.snapshot.selectedAgentId,
  );
  const agent = useNcpSessionConversation(sessionKey ?? undefined);
  const runQueue = useSessionRunQueue(sessionKey);
  const { inputActions, inputSnapshot } = useSessionConversationInputState(
    initialPrompt,
    sessionKey,
  );
  const applySystemObjectReference = useCallback((reference: SystemObjectResolvedReference) => {
    inputActions.update((current) => {
      const nodes = appendSystemObjectReferenceToken(current.nodes, reference);
      return {
        nodes,
        text: deriveChatComposerDraft(nodes),
        composerFocusRequestId: Date.now(),
        sendError: null,
      };
    });
  }, [inputActions]);
  const inputQuery = useSessionConversationInputQuery({
    sessionKey,
    inputSnapshot,
    setPendingSessionType: inputActions.setPendingSessionType,
  });
  const [compactingSessionIds, setCompactingSessionIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const handleContextCompactingChange = useCallback(
    (compactingSessionId: string, isCompacting: boolean) => {
      setCompactingSessionIds((current) => {
        const next = new Set(current);
        if (isCompacting) {
          next.add(compactingSessionId);
        } else {
          next.delete(compactingSessionId);
        }
        return next;
      });
    },
    [],
  );
  useEffect(() => {
    inputActions.syncSessionPreferences({
      defaultModel: inputQuery.defaultModel,
      fallbackPreferredModel: inputQuery.fallbackPreferredModel,
      fallbackPreferredThinking: inputQuery.fallbackPreferredThinking,
      modelOptions: inputQuery.modelOptions,
      selectedSessionExists: Boolean(inputQuery.selectedSession),
      selectedSessionKey: inputQuery.selectedSessionKey,
      selectedSessionType: inputQuery.sessionTypeState.selectedSessionType,
      selectedSessionPreferredModel:
        inputQuery.selectedSession?.preferredModel ?? undefined,
      selectedSessionPreferredThinking:
        inputQuery.selectedSession?.preferredThinking ?? null,
    });
  }, [
    inputActions,
    inputQuery.defaultModel,
    inputQuery.fallbackPreferredModel,
    inputQuery.fallbackPreferredThinking,
    inputQuery.modelOptions,
    inputQuery.selectedSession,
    inputQuery.selectedSessionKey,
    inputQuery.sessionTypeState.selectedSessionType,
  ]);
  useSessionConversationDraftRouteState({
    applyPromptSuggestion: inputActions.applyPromptSuggestion,
    sessionKey,
    setPendingProjectRoot: inputActions.setPendingProjectRoot,
    setPendingSessionType: inputActions.setPendingSessionType,
  });
  const isRuntimeBlocked = isNcpChatRuntimeBlocked(systemStatus);
  const currentSessionRunning =
    agent.isRunning || inputQuery.selectedSession?.status === "running";
  const runtimeError = agent.snapshot.error;
  const rawLastSendError = agent.hydrateError?.message
    ?? (runtimeError?.code === "run-interrupted" ? null : runtimeError?.message)
    ?? null;
  const filteredLastSendError =
    systemStatus.phase === "ready" &&
    isNcpAgentStartupUnavailableErrorMessage(rawLastSendError)
      ? null
      : rawLastSendError;
  const lastSendError = isRuntimeBlocked
    ? null
    : systemStatus.phase === "ready"
      ? filteredLastSendError
      : resolveNcpChatSendErrorMessage({
          message: filteredLastSendError,
          status: systemStatus,
        });
  const controllerAgent = useMemo(
    () => ({
      ...agent,
      isRunning: currentSessionRunning,
      isSending: agent.isSending,
    }),
    [agent, currentSessionRunning],
  );
  const controller = useSessionConversationController({
    agent: controllerAgent,
    inputSnapshot,
    inputQuery,
    isRuntimeBlocked,
    materializationContext,
    runQueue,
    selectedAgentId,
    sessionKey,
    onSessionMaterialized,
    resetComposer: inputActions.resetComposer,
    restoreComposer: inputActions.restoreComposer,
    setSendError: inputActions.setSendError,
  });
  const conversationMessages = useMemo(() => {
    const durableMessageIds = new Set(agent.visibleMessages.map(({ id }) => id));
    const pendingSteeringMessages = runQueue.pendingInputs.flatMap((input) =>
      input.placement === "steering" && !durableMessageIds.has(input.message.id)
        ? [{ ...input.message, status: "pending" as const }]
        : []
    );
    return [...agent.visibleMessages, ...pendingSteeringMessages];
  }, [agent.visibleMessages, runQueue.pendingInputs]);
  const controllerRef = useRef(controller);
  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);
  const inputController = useMemo<SessionConversationInputController>(
    () => ({
      canEditQueuedInput: controller.canEditQueuedInput,
      canStopGeneration: controller.canStopGeneration,
      deleteQueuedInput: (id: string) =>
        controllerRef.current.deleteQueuedInput(id),
      editQueuedInput: (id: string) =>
        controllerRef.current.editQueuedInput(id),
      isSending: controller.isSending,
      primaryAction: controller.primaryAction,
      queuedInputs: controller.queuedInputs,
      send: () => controllerRef.current.send(),
      sendSteering: () => controllerRef.current.sendSteering(),
      sendPresetMessage: (message: string) =>
        controllerRef.current.sendPresetMessage(message).catch(() => undefined),
      sendDisabled: controller.sendDisabled,
      stop: () => controllerRef.current.stop(),
      stopDisabled: controller.stopDisabled,
      steerQueuedInput: (id: string) => controllerRef.current.steerQueuedInput(id),
    }),
    [
      controller.canStopGeneration,
      controller.canEditQueuedInput,
      controller.isSending,
      controller.primaryAction,
      controller.queuedInputs,
      controller.sendDisabled,
      controller.stopDisabled,
    ],
  );
  const contextWindow = useMemo(
    () =>
      buildChatContextWindowIndicator(
        readNcpContextWindowValue(agent.snapshot.contextWindow),
      ),
    [agent.snapshot.contextWindow],
  );
  const { selectedSession } = inputQuery;
  const conversationFailureMessage =
    inputSnapshot.sendError?.trim() ||
    lastSendError?.trim() ||
    (selectedSession?.activityPreview?.state === "failed" &&
      selectedSession.activityPreview.statusKind !== "run-interrupted"
      ? selectedSession.activityPreview.statusText?.trim()
      : null) ||
    null;
  const conversationFailureSlot = conversationFailureMessage ? (
    <div
      className="rounded-lg border-l-2 border-destructive/40 bg-muted/45 px-3 py-2.5"
      role="status"
    >
      <pre className="max-h-32 select-text overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
        {conversationFailureMessage}
      </pre>
    </div>
  ) : null;
  useSessionConversationDraftIntent({
    consumeDraftIntent,
    applyPromptSuggestion: inputActions.applyPromptSuggestion,
    applySystemObjectReference,
  });
  const renderInput = useCallback(
    (surface: "default" | "embedded", placeholder?: string) => (
      <SessionConversationInput
        contextWindow={contextWindow}
        controller={inputController}
        inputActions={inputActions}
        inputQuery={inputQuery}
        inputSnapshot={inputSnapshot}
        onContextCompactingChange={handleContextCompactingChange}
        placeholder={placeholder}
        surface={surface}
      />
    ),
    [
      contextWindow,
      inputController,
      inputActions,
      inputQuery,
      inputSnapshot,
      handleContextCompactingChange,
    ],
  );
  const showWelcome =
    showWelcomeForDraft &&
    !sessionKey &&
    conversationMessages.length === 0 &&
    !agent.isHydrating &&
    !controller.isSending;

  return (
    <>
      <SessionConversationAlerts inputQuery={inputQuery} />
      <ChatConversationContent
        hasPreviousMessages={agent.hasPreviousMessages}
        historyError={agent.historyError}
        isHistoryLoading={agent.isHydrating}
        isLoadingPreviousMessages={agent.isLoadingPreviousMessages}
        isSending={controller.isSending}
        canContinue={controller.canContinue}
        messageActionsDisabled={controller.isSending || isRuntimeBlocked}
        isContextCompacting={Boolean(
          sessionKey && compactingSessionIds.has(sessionKey),
        )}
        bottomSlot={showWelcome ? null : conversationFailureSlot}
        messages={conversationMessages}
        messageDetailStates={agent.messageDetailStates}
        sessionKey={sessionKey}
        showWelcome={showWelcome}
        onLoadPreviousMessages={agent.loadPreviousMessages}
        onLoadMessageDetails={agent.loadMessageDetails}
        onContinueRun={() => controllerRef.current.continueRun()}
        onEditMessage={(payload) => controllerRef.current.editMessage(payload)}
        welcomeSlot={
          <ChatConversationWelcome
            inputSlot={
              <div className="space-y-2">
                {renderInput("embedded", t("chatWelcomeInputPlaceholder"))}
                {conversationFailureSlot}
              </div>
            }
            pendingProjectRoot={inputSnapshot.pendingProjectRoot}
            pendingSessionType={inputSnapshot.pendingSessionType}
            selectedSessionTypeValue={inputSnapshot.selectedSessionType}
            onSelectProjectRoot={inputActions.setPendingProjectRoot}
            onSelectPrompt={inputActions.applyPromptSuggestion}
            onSelectSessionType={inputActions.setPendingSessionType}
          />
        }
      />
      {showWelcome ? null : renderInput("default")}
    </>
  );
}
