import { useCallback, useMemo } from 'react';
import { buildNcpRequestEnvelope } from '@nextclaw/ncp-react';
import type {
  UiNcpSessionPendingInputView,
  UiNcpSessionQueuedInputView,
} from '@nextclaw/client-sdk';
import type { NcpAgentSendEnvelope, NcpRunHandle } from '@nextclaw/ncp';

import {
  createChatComposerNodesFromDraft,
  deriveNcpMessagePartsFromComposer,
} from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { isNcpChatSendDisabled } from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';
import { buildChatRunMetadata } from '@/features/chat/features/session/utils/chat-run-metadata.utils';
import { createNcpSessionId } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import type { SessionQueuedInputAttachmentPreview } from '@/features/chat/features/conversation/utils/session-queued-input.utils';
import type { SessionConversationInputSnapshot } from './use-session-conversation-input-state';
import type { useSessionConversationInputQuery } from './use-session-conversation-input-query';
import {
  useQueuedInputActions,
  useSubmittingQueuedInputProjection,
  type SubmittingQueuedInput,
} from './use-session-pending-input-actions';
import {
  useSessionConversationRecoveryActions,
  type SessionConversationRecoveryAgent,
} from './use-session-conversation-recovery-actions';

type SessionConversationInputQuery = ReturnType<typeof useSessionConversationInputQuery>;
type ComposerDraftSnapshot = Pick<
  SessionConversationInputSnapshot,
  'text' | 'nodes' | 'selectedSkills' | 'skillRecords' | 'attachments'
>;

type SessionConversationAgent = SessionConversationRecoveryAgent & {
  readonly isHydrating: boolean;
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
  readonly attachments?: readonly SessionQueuedInputAttachmentPreview[];
  readonly id: string;
  readonly isSubmitting?: boolean;
  readonly preview: string;
};

type SessionRunQueue = {
  readonly inputs: readonly UiNcpSessionQueuedInputView[];
  readonly refreshPendingInputs: () => Promise<readonly UiNcpSessionPendingInputView[]>;
  readonly refreshQueuedInputs: () => Promise<readonly UiNcpSessionQueuedInputView[]>;
  readonly removeQueuedInput: (
    queuedInputId: string,
  ) => Promise<UiNcpSessionQueuedInputView | null>;
  readonly steerQueuedInput: (
    queuedInputId: string,
  ) => Promise<UiNcpSessionPendingInputView | null>;
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
  readonly runQueue: SessionRunQueue;
  readonly selectedAgentId: string;
  readonly sessionKey: string | null;
  readonly onSessionMaterialized?: (sessionKey: string) => void;
  readonly resetComposer: () => void;
  readonly restoreComposer: (snapshot: ComposerDraftSnapshot) => void;
  readonly setSendError: (message: string | null) => void;
};

type BuildSubmissionDraftParams = {
  readonly agentIsSending: boolean;
  readonly composerSnapshot?: ComposerDraftSnapshot;
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly inputQuery: SessionConversationInputQuery;
  readonly isRuntimeBlocked: boolean;
  readonly materializationContext?: SessionConversationMaterializationContext | null;
  readonly selectedAgentId: string;
  readonly sessionKey: string | null;
};

type SubmissionDraft = {
  readonly composerSnapshot: ComposerDraftSnapshot;
  readonly metadata: Record<string, unknown>;
};

type SubmissionComposerBehavior = 'preserve' | 'reset-and-restore';

const hasSendableMessagePart = (parts: ReturnType<typeof deriveNcpMessagePartsFromComposer>): boolean =>
  parts.some((part) => part.type !== 'text' || part.text.trim().length > 0);

const resolveModelForSend = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

function buildInputAvailabilitySnapshot(inputQuery: SessionConversationInputQuery) {
  return {
    isProviderStateResolved: inputQuery.isProviderStateResolved,
    modelOptions: inputQuery.modelOptions,
    sessionTypeUnavailable: inputQuery.sessionTypeState.sessionTypeUnavailable,
  };
}

function buildSubmissionDraft(params: BuildSubmissionDraftParams): SubmissionDraft | null {
  const {
    agentIsSending,
    composerSnapshot: requestedComposerSnapshot,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    selectedAgentId,
    sessionKey,
  } = params;
  const composerSnapshot: ComposerDraftSnapshot = requestedComposerSnapshot ?? {
    text: inputSnapshot.text,
    nodes: [...inputSnapshot.nodes],
    selectedSkills: [...inputSnapshot.selectedSkills],
    skillRecords: [...inputSnapshot.skillRecords],
    attachments: [...inputSnapshot.attachments],
  };
  const currentParts = deriveNcpMessagePartsFromComposer(
    [...composerSnapshot.nodes],
    composerSnapshot.attachments,
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
  return {
    composerSnapshot,
    metadata: buildChatRunMetadata({
      agentId: materializationContext
        ? undefined
        : inputQuery.selectedSession?.agentId?.trim() || selectedAgentId,
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
      skillRecords: inputQuery.skillRecords.filter((record) =>
        composerSnapshot.selectedSkills.includes(record.ref)
      ),
      composerNodes: [...composerSnapshot.nodes],
      sessionMaterialization: materializationContext
        ? {
            kind: materializationContext.kind,
            parentSessionId: materializationContext.parentSessionKey,
            inheritContext: materializationContext.inheritContext,
          }
        : null,
    }),
  };
}

function buildSubmissionEnvelope(
  draft: SubmissionDraft,
  sessionKey: string | null,
  delivery: NcpAgentSendEnvelope['delivery'] = 'queue',
): NcpAgentSendEnvelope | null {
  const envelope = buildNcpRequestEnvelope({
    sessionId: sessionKey ?? undefined,
    text: draft.composerSnapshot.text.trim(),
    attachments: [...draft.composerSnapshot.attachments],
    parts: deriveNcpMessagePartsFromComposer(
      [...draft.composerSnapshot.nodes],
      draft.composerSnapshot.attachments,
    ),
    metadata: draft.metadata,
  });
  return envelope ? { ...envelope, delivery } : null;
}

function useSubmissionDraftRunner(params: {
  readonly agent: SessionConversationAgent;
  readonly clearSubmittingInput: (input: SubmittingQueuedInput) => void;
  readonly materializationContext?: SessionConversationMaterializationContext | null;
  readonly onSessionMaterialized?: (sessionKey: string) => void;
  readonly resetComposer: () => void;
  readonly restoreComposer: (snapshot: ComposerDraftSnapshot) => void;
  readonly runQueue: SessionRunQueue;
  readonly sessionKey: string | null;
  readonly setSendError: (message: string | null) => void;
  readonly stageSubmittingInput: (envelope: NcpAgentSendEnvelope) => SubmittingQueuedInput | null;
}) {
  const {
    agent,
    clearSubmittingInput,
    materializationContext,
    onSessionMaterialized,
    resetComposer,
    restoreComposer,
    runQueue,
    sessionKey,
    setSendError,
    stageSubmittingInput,
  } = params;
  return useCallback(async (
    draft: SubmissionDraft,
    composerBehavior: SubmissionComposerBehavior,
    delivery: NcpAgentSendEnvelope['delivery'] = 'queue',
  ) => {
    const submissionSessionKey =
      sessionKey ?? (materializationContext ? null : createNcpSessionId());
    const envelope = buildSubmissionEnvelope(draft, submissionSessionKey, delivery);
    if (!envelope) return;
    const queuedSubmission = agent.isRunning && delivery === 'queue'
      ? stageSubmittingInput(envelope)
      : null;
    if (composerBehavior === 'reset-and-restore') resetComposer();
    setSendError(null);
    try {
      const handle = await agent.send(envelope);
      if (handle?.delivery === 'steered') {
        await runQueue.refreshPendingInputs().catch(() => undefined);
      } else if (handle?.delivery === 'queued') {
        await runQueue.refreshQueuedInputs().catch(() => undefined);
      }
      if (queuedSubmission) clearSubmittingInput(queuedSubmission);
      const materializedSessionKey =
        handle?.sessionId?.trim() || agent.snapshot.activeRun?.sessionId?.trim() || null;
      if (!sessionKey && materializedSessionKey) {
        onSessionMaterialized?.(materializedSessionKey);
      }
    } catch (error) {
      if (queuedSubmission) clearSubmittingInput(queuedSubmission);
      if (composerBehavior === 'reset-and-restore') restoreComposer(draft.composerSnapshot);
      setSendError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, [
    agent,
    clearSubmittingInput,
    materializationContext,
    onSessionMaterialized,
    resetComposer,
    restoreComposer,
    runQueue,
    sessionKey,
    setSendError,
    stageSubmittingInput,
  ]);
}

function useSteeringSubmission(params: {
  readonly agent: SessionConversationAgent;
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly inputQuery: SessionConversationInputQuery;
  readonly isRuntimeBlocked: boolean;
  readonly materializationContext?: SessionConversationMaterializationContext | null;
  readonly selectedAgentId: string;
  readonly sessionKey: string | null;
  readonly submitDraft: (
    draft: SubmissionDraft,
    composerBehavior: SubmissionComposerBehavior,
    delivery?: NcpAgentSendEnvelope['delivery'],
  ) => Promise<void>;
}) {
  const {
    agent,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    selectedAgentId,
    sessionKey,
    submitDraft,
  } = params;
  return useCallback(async () => {
    const draft = buildSubmissionDraft({
      agentIsSending: agent.isSending,
      inputSnapshot,
      inputQuery,
      isRuntimeBlocked,
      materializationContext,
      selectedAgentId,
      sessionKey,
    });
    if (draft) await submitDraft(draft, 'reset-and-restore', 'prefer-steer');
  }, [
    agent.isSending,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    selectedAgentId,
    sessionKey,
    submitDraft,
  ]);
}

function usePrimarySubmission(params: {
  readonly agent: SessionConversationAgent;
  readonly continueRun: () => Promise<void>;
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly inputQuery: SessionConversationInputQuery;
  readonly isRuntimeBlocked: boolean;
  readonly materializationContext?: SessionConversationMaterializationContext | null;
  readonly primaryAction: 'continue' | 'send';
  readonly selectedAgentId: string;
  readonly sessionKey: string | null;
  readonly submitDraft: (
    draft: SubmissionDraft,
    composerBehavior: SubmissionComposerBehavior,
  ) => Promise<void>;
}) {
  const {
    agent,
    continueRun,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    primaryAction,
    selectedAgentId,
    sessionKey,
    submitDraft,
  } = params;
  return useCallback(async () => {
    if (primaryAction === 'continue') return await continueRun();
    const draft = buildSubmissionDraft({
      agentIsSending: agent.isSending,
      inputSnapshot,
      inputQuery,
      isRuntimeBlocked,
      materializationContext,
      selectedAgentId,
      sessionKey,
    });
    if (draft) await submitDraft(draft, 'reset-and-restore');
  }, [
    agent.isSending,
    continueRun,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    primaryAction,
    selectedAgentId,
    sessionKey,
    submitDraft,
  ]);
}

export function useSessionConversationController(params: UseSessionConversationControllerParams) {
  const {
    agent,
    inputSnapshot,
    inputQuery,
    isRuntimeBlocked,
    materializationContext,
    runQueue,
    selectedAgentId,
    sessionKey,
    onSessionMaterialized,
    resetComposer,
    restoreComposer,
    setSendError,
  } = params;
  const {
    clearSubmittingInput,
    queuedInputs,
    stageSubmittingInput,
  } = useSubmittingQueuedInputProjection(runQueue.inputs, sessionKey);
  const parts = useMemo(
    () => deriveNcpMessagePartsFromComposer([...inputSnapshot.nodes], inputSnapshot.attachments),
    [inputSnapshot.attachments, inputSnapshot.nodes],
  );
  const hasSendableDraft = hasSendableMessagePart(parts);
  const { deleteQueuedInput, editQueuedInput, steerQueuedInput } = useQueuedInputActions({
    availableSkills: inputQuery.skillRecords,
    hasComposerContent: hasSendableDraft,
    restoreComposer,
    runQueue,
    setSendError,
  });
  const isSending = agent.isSending || agent.isRunning;
  const activityState = inputQuery.selectedSession?.activityPreview?.state;
  const canContinue = Boolean(
    sessionKey &&
    !isSending &&
    !isRuntimeBlocked &&
    (activityState === 'cancelled' || activityState === 'failed'),
  );
  const primaryAction: 'continue' | 'send' =
    canContinue && !hasSendableDraft ? 'continue' : 'send';
  const sendDisabled = primaryAction === 'continue'
    ? false
    : isNcpChatSendDisabled({
        snapshot: buildInputAvailabilitySnapshot(inputQuery),
        hasSendableDraft,
        isRuntimeBlocked,
      }) || agent.isSending;

  const { continueRun, editMessage } = useSessionConversationRecoveryActions({
    agent,
    sessionKey,
    setSendError,
  });

  const submitDraft = useSubmissionDraftRunner({
    agent,
    clearSubmittingInput,
    materializationContext,
    onSessionMaterialized,
    resetComposer,
    restoreComposer,
    runQueue,
    sessionKey,
    setSendError,
    stageSubmittingInput,
  });

  const send = usePrimarySubmission({
    agent,
    continueRun,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    primaryAction,
    selectedAgentId,
    sessionKey,
    submitDraft,
  });

  const sendSteering = useSteeringSubmission({
    agent,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    selectedAgentId,
    sessionKey,
    submitDraft,
  });

  const sendPresetMessage = useCallback(async (message: string) => {
    const text = message.trim();
    if (!text) {
      return;
    }
    const draft = buildSubmissionDraft({
      agentIsSending: agent.isSending,
      composerSnapshot: {
        text,
        nodes: createChatComposerNodesFromDraft(text),
        selectedSkills: [],
        skillRecords: [],
        attachments: [],
      },
      inputSnapshot,
      inputQuery,
      isRuntimeBlocked,
      materializationContext,
      selectedAgentId,
      sessionKey,
    });
    if (draft) {
      await submitDraft(draft, 'preserve');
    }
  }, [
    agent.isSending,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    selectedAgentId,
    sessionKey,
    submitDraft,
  ]);

  const stop = useCallback(async () => {
    await agent.abort();
  }, [agent]);

  return {
    canContinue,
    canStopGeneration: agent.isRunning,
    continueRun,
    deleteQueuedInput,
    editMessage,
    editQueuedInput,
    canEditQueuedInput: !hasSendableDraft,
    hasSendableDraft,
    isSending,
    queuedInputs,
    send,
    sendSteering,
    sendPresetMessage,
    sendDisabled,
    primaryAction,
    stop,
    stopDisabled: !agent.isRunning,
    steerQueuedInput,
  };
}
