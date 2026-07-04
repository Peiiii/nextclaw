import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { buildNcpRequestEnvelope } from '@nextclaw/ncp-react';
import type { NcpAgentSendEnvelope, NcpMessage, NcpRunHandle } from '@nextclaw/ncp';

import { deriveNcpMessagePartsFromComposer } from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { isNcpChatSendDisabled } from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';
import { buildChatRunMetadata } from '@/features/chat/features/session/utils/chat-run-metadata.utils';
import type { SessionConversationInputSnapshot } from './use-session-conversation-input-state';
import type { useSessionConversationInputQuery } from './use-session-conversation-input-query';

type SessionConversationInputQuery = ReturnType<typeof useSessionConversationInputQuery>;
type ComposerDraftSnapshot = Pick<
  SessionConversationInputSnapshot,
  'text' | 'nodes' | 'selectedSkills' | 'skillRecords' | 'attachments'
>;

type SessionConversationAgent = {
  readonly isHydrating: boolean;
  readonly isSending: boolean;
  readonly isRunning: boolean;
  readonly visibleMessages: readonly NcpMessage[];
  readonly snapshot: {
    readonly activeRun?: {
      readonly sessionId?: string | null;
    } | null;
  };
  readonly send: (
    envelope: NcpAgentSendEnvelope,
  ) => Promise<NcpRunHandle | null>;
  readonly abort: () => Promise<void>;
};

export type SessionConversationQueuedInput = {
  readonly id: string;
  readonly preview: string;
};

type QueuedInputDraft = SessionConversationQueuedInput & {
  readonly composerSnapshot: ComposerDraftSnapshot;
  readonly metadata: Record<string, unknown>;
};

export type SessionConversationMaterializationContext = {
  readonly kind: 'child';
  readonly parentSessionKey: string;
  readonly inheritContext: true;
};

type UseSessionConversationControllerParams = {
  readonly agent: SessionConversationAgent;
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly inputQuery: SessionConversationInputQuery;
  readonly isRuntimeBlocked: boolean;
  readonly materializationContext?: SessionConversationMaterializationContext | null;
  readonly selectedAgentId: string;
  readonly sessionKey: string | null;
  readonly onSessionMaterialized?: (sessionKey: string) => void;
  readonly resetComposer: () => void;
  readonly restoreComposer: (snapshot: ComposerDraftSnapshot) => void;
  readonly setSendError: (message: string | null) => void;
};

type BuildQueuedInputDraftParams = {
  readonly agentIsSending: boolean;
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly inputQuery: SessionConversationInputQuery;
  readonly isRuntimeBlocked: boolean;
  readonly materializationContext?: SessionConversationMaterializationContext | null;
  readonly selectedAgentId: string;
  readonly sessionKey: string | null;
};

type SendEnvelope = (
  envelope: NcpAgentSendEnvelope,
) => Promise<NcpRunHandle | null>;

type SendQueuedDraft = (
  draft: QueuedInputDraft,
) => Promise<NcpRunHandle | null>;

type UseQueuedDraftAutoSendParams = {
  readonly agentIsRunning: boolean;
  readonly agentIsSending: boolean;
  readonly queuedDrafts: readonly QueuedInputDraft[];
  readonly sendQueuedDraft: SendQueuedDraft;
  readonly setQueuedDrafts: Dispatch<SetStateAction<QueuedInputDraft[]>>;
  readonly setSendError: (message: string | null) => void;
};

type StartQueuedDraftAutoSendParams = {
  readonly autoSendingQueuedDraftIdRef: MutableRefObject<string | null>;
  readonly draft: QueuedInputDraft;
  readonly sendQueuedDraft: SendQueuedDraft;
  readonly setQueuedDrafts: Dispatch<SetStateAction<QueuedInputDraft[]>>;
  readonly setSendError: (message: string | null) => void;
};

type UseQueuedDraftActionsParams = {
  readonly queuedDrafts: readonly QueuedInputDraft[];
  readonly restoreComposer: (snapshot: ComposerDraftSnapshot) => void;
  readonly setQueuedDrafts: Dispatch<SetStateAction<QueuedInputDraft[]>>;
  readonly setSendError: (message: string | null) => void;
};

const hasSendableMessagePart = (parts: ReturnType<typeof deriveNcpMessagePartsFromComposer>): boolean =>
  parts.some((part) => part.type !== 'text' || part.text.trim().length > 0);

const resolveModelForSend = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

function buildQueuedInputPreview(snapshot: Pick<
  SessionConversationInputSnapshot,
  'attachments' | 'text'
>): string {
  const compactText = snapshot.text.replace(/\s+/g, ' ').trim();
  if (compactText) {
    return compactText;
  }
  return snapshot.attachments.map((attachment) => attachment.name).filter(Boolean).join(', ');
}

function buildInputAvailabilitySnapshot(inputQuery: SessionConversationInputQuery) {
  return {
    isProviderStateResolved: inputQuery.isProviderStateResolved,
    modelOptions: inputQuery.modelOptions,
    sessionTypeUnavailable: inputQuery.sessionTypeState.sessionTypeUnavailable,
  };
}

function buildQueuedInputDraft(params: BuildQueuedInputDraftParams): QueuedInputDraft | null {
  const {
    agentIsSending,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    selectedAgentId,
    sessionKey,
  } = params;
  const currentParts = deriveNcpMessagePartsFromComposer(
    [...inputSnapshot.nodes],
    inputSnapshot.attachments,
  );
  if (
    isNcpChatSendDisabled({
      snapshot: buildInputAvailabilitySnapshot(inputQuery),
      hasSendableDraft: hasSendableMessagePart(currentParts),
      isRuntimeBlocked,
    }) ||
    agentIsSending
  ) {
    return null;
  }
  const composerSnapshot: ComposerDraftSnapshot = {
    text: inputSnapshot.text,
    nodes: [...inputSnapshot.nodes],
    selectedSkills: [...inputSnapshot.selectedSkills],
    skillRecords: [...inputSnapshot.skillRecords],
    attachments: [...inputSnapshot.attachments],
  };
  const metadata = buildChatRunMetadata({
    agentId: materializationContext ? undefined : selectedAgentId,
    model: materializationContext
      ? resolveModelForSend(inputSnapshot.selectedModel)
      : resolveModelForSend(
          inputSnapshot.selectedModel ??
          inputQuery.fallbackPreferredModel ??
          inputQuery.defaultModel,
        ),
    thinkingLevel: materializationContext
      ? inputSnapshot.selectedThinkingLevel ?? undefined
      : inputSnapshot.selectedThinkingLevel ?? inputQuery.fallbackPreferredThinking ?? undefined,
    sessionType: materializationContext
      ? undefined
      : inputQuery.sessionTypeState.selectedSessionType,
    projectRoot: materializationContext
      ? inputSnapshot.pendingProjectRoot
      : sessionKey
        ? inputQuery.selectedSession?.projectRoot ?? null
        : inputSnapshot.pendingProjectRoot,
    requestedSkills: [...inputSnapshot.selectedSkills],
    composerNodes: [...inputSnapshot.nodes],
    sessionMaterialization: materializationContext
      ? {
          kind: materializationContext.kind,
          parentSessionId: materializationContext.parentSessionKey,
          inheritContext: materializationContext.inheritContext,
        }
      : null,
  });
  return {
    composerSnapshot,
    id: `queued-input-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    metadata,
    preview: buildQueuedInputPreview(composerSnapshot),
  };
}

function buildQueuedDraftEnvelope(
  draft: QueuedInputDraft,
  sessionKey: string | null,
): NcpAgentSendEnvelope | null {
  return buildNcpRequestEnvelope({
    sessionId: sessionKey ?? undefined,
    text: draft.composerSnapshot.text.trim(),
    attachments: [...draft.composerSnapshot.attachments],
    parts: deriveNcpMessagePartsFromComposer(
      [...draft.composerSnapshot.nodes],
      draft.composerSnapshot.attachments,
    ),
    metadata: draft.metadata,
  });
}

function startQueuedDraftAutoSend(params: StartQueuedDraftAutoSendParams): void {
  const {
    autoSendingQueuedDraftIdRef,
    draft,
    sendQueuedDraft,
    setQueuedDrafts,
    setSendError,
  } = params;
  autoSendingQueuedDraftIdRef.current = draft.id;
  setQueuedDrafts((current) => current[0]?.id === draft.id ? current.slice(1) : current);
  setSendError(null);
  void sendQueuedDraft(draft)
    .catch((error) => {
      setQueuedDrafts((current) => [draft, ...current]);
      const message = error instanceof Error ? error.message : String(error);
      setSendError(message);
    })
    .finally(() => {
      autoSendingQueuedDraftIdRef.current = null;
    });
}

function useQueuedDraftAutoSend(params: UseQueuedDraftAutoSendParams) {
  const {
    agentIsRunning,
    agentIsSending,
    queuedDrafts,
    sendQueuedDraft,
    setQueuedDrafts,
    setSendError,
  } = params;
  const autoSendingQueuedDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      agentIsRunning ||
      agentIsSending ||
      autoSendingQueuedDraftIdRef.current ||
      queuedDrafts.length === 0
    ) {
      return;
    }
    startQueuedDraftAutoSend({
      autoSendingQueuedDraftIdRef,
      draft: queuedDrafts[0],
      sendQueuedDraft,
      setQueuedDrafts,
      setSendError,
    });
  }, [
    agentIsRunning,
    agentIsSending,
    queuedDrafts,
    sendQueuedDraft,
    setQueuedDrafts,
    setSendError,
  ]);
}

function useQueuedDraftActions(params: UseQueuedDraftActionsParams) {
  const {
    queuedDrafts,
    restoreComposer,
    setQueuedDrafts,
    setSendError,
  } = params;

  const editQueuedInput = useCallback((id: string) => {
    const draft = queuedDrafts.find((item) => item.id === id);
    if (!draft) {
      return;
    }
    setQueuedDrafts((current) => current.filter((item) => item.id !== id));
    restoreComposer(draft.composerSnapshot);
    setSendError(null);
  }, [
    queuedDrafts,
    restoreComposer,
    setQueuedDrafts,
    setSendError,
  ]);

  const deleteQueuedInput = useCallback((id: string) => {
    setQueuedDrafts((current) => current.filter((item) => item.id !== id));
    setSendError(null);
  }, [
    setQueuedDrafts,
    setSendError,
  ]);

  return {
    deleteQueuedInput,
    editQueuedInput,
  };
}

export function useSessionConversationController(params: UseSessionConversationControllerParams) {
  const {
    agent,
    inputSnapshot,
    inputQuery,
    isRuntimeBlocked,
    materializationContext,
    selectedAgentId,
    sessionKey,
    onSessionMaterialized,
    resetComposer,
    restoreComposer,
    setSendError,
  } = params;
  const parts = useMemo(
    () => deriveNcpMessagePartsFromComposer([...inputSnapshot.nodes], inputSnapshot.attachments),
    [inputSnapshot.attachments, inputSnapshot.nodes],
  );
  const hasSendableDraft = hasSendableMessagePart(parts);
  const isSending = agent.isSending || agent.isRunning;
  const baseSendDisabled = isNcpChatSendDisabled({
    snapshot: buildInputAvailabilitySnapshot(inputQuery),
    hasSendableDraft,
    isRuntimeBlocked,
  });
  const sendDisabled = baseSendDisabled || agent.isSending;
  const [queuedDrafts, setQueuedDrafts] = useState<QueuedInputDraft[]>([]);

  const buildDraftSubmission = useCallback((): QueuedInputDraft | null => {
    return buildQueuedInputDraft({
      agentIsSending: agent.isSending,
      inputSnapshot,
      inputQuery,
      isRuntimeBlocked,
      materializationContext,
      selectedAgentId,
      sessionKey,
    });
  }, [
    agent.isSending,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    selectedAgentId,
    sessionKey,
  ]);

  const sendEnvelope = useCallback<SendEnvelope>(async (envelope) => {
    const handle = await agent.send(envelope);
    const materializedSessionKey =
      handle?.sessionId?.trim() ||
      agent.snapshot.activeRun?.sessionId?.trim() ||
      null;
    if (!sessionKey && materializedSessionKey) {
      onSessionMaterialized?.(materializedSessionKey);
    }
    return handle;
  }, [
    agent,
    onSessionMaterialized,
    sessionKey,
  ]);

  const sendQueuedDraft = useCallback<SendQueuedDraft>(async (draft) => {
    const envelope = buildQueuedDraftEnvelope(draft, sessionKey);
    if (!envelope) {
      return null;
    }
    return sendEnvelope(envelope);
  }, [
    sendEnvelope,
    sessionKey,
  ]);

  const send = useCallback(async () => {
    const draft = buildDraftSubmission();
    if (!draft) {
      return;
    }
    resetComposer();
    setSendError(null);
    if (agent.isRunning) {
      setQueuedDrafts((current) => [...current, draft]);
      return;
    }
    try {
      await sendQueuedDraft(draft);
    } catch (error) {
      restoreComposer(draft.composerSnapshot);
      const message = error instanceof Error ? error.message : String(error);
      setSendError(message);
      throw error;
    }
  }, [
    agent.isRunning,
    buildDraftSubmission,
    resetComposer,
    restoreComposer,
    sendQueuedDraft,
    setSendError,
  ]);

  const queuedDraftActions = useQueuedDraftActions({
    queuedDrafts,
    restoreComposer,
    setQueuedDrafts,
    setSendError,
  });

  useQueuedDraftAutoSend({
    agentIsRunning: agent.isRunning,
    agentIsSending: agent.isSending,
    queuedDrafts,
    sendQueuedDraft,
    setQueuedDrafts,
    setSendError,
  });

  const stop = useCallback(async () => {
    await agent.abort();
  }, [agent]);

  return {
    canStopGeneration: agent.isRunning,
    ...queuedDraftActions,
    hasSendableDraft,
    isSending,
    queuedInputs: queuedDrafts.map(({ id, preview }) => ({ id, preview })),
    send,
    sendDisabled,
    stop,
    stopDisabled: !agent.isRunning,
  };
}
