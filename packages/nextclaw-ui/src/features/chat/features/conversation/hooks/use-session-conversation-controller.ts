import { useCallback, useMemo } from 'react';
import { buildNcpRequestEnvelope } from '@nextclaw/ncp-react';
import type { UiNcpSessionQueuedInputView } from '@nextclaw/client-sdk';
import type { NcpAgentSendEnvelope, NcpMessage, NcpRunHandle } from '@nextclaw/ncp';

import { deriveNcpMessagePartsFromComposer } from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { isNcpChatSendDisabled } from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';
import { buildChatRunMetadata } from '@/features/chat/features/session/utils/chat-run-metadata.utils';
import {
  buildSessionQueuedInputComposerSnapshot,
  buildSessionQueuedInputPreview,
} from '@/features/chat/features/conversation/utils/session-queued-input.utils';
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

type SessionRunQueue = {
  readonly inputs: readonly UiNcpSessionQueuedInputView[];
  readonly removeQueuedInput: (
    queuedInputId: string,
  ) => Promise<UiNcpSessionQueuedInputView | null>;
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
  return {
    composerSnapshot,
    metadata: buildChatRunMetadata({
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
      skillRecords: inputQuery.skillRecords.filter((record) =>
        inputSnapshot.selectedSkills.includes(record.ref)
      ),
      composerNodes: [...inputSnapshot.nodes],
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
  const parts = useMemo(
    () => deriveNcpMessagePartsFromComposer([...inputSnapshot.nodes], inputSnapshot.attachments),
    [inputSnapshot.attachments, inputSnapshot.nodes],
  );
  const hasSendableDraft = hasSendableMessagePart(parts);
  const isSending = agent.isSending || agent.isRunning;
  const sendDisabled = isNcpChatSendDisabled({
    snapshot: buildInputAvailabilitySnapshot(inputQuery),
    hasSendableDraft,
    isRuntimeBlocked,
  }) || agent.isSending;

  const send = useCallback(async () => {
    const draft = buildSubmissionDraft({
      agentIsSending: agent.isSending,
      inputSnapshot,
      inputQuery,
      isRuntimeBlocked,
      materializationContext,
      selectedAgentId,
      sessionKey,
    });
    if (!draft) {
      return;
    }
    const envelope = buildSubmissionEnvelope(draft, sessionKey);
    if (!envelope) {
      return;
    }
    resetComposer();
    setSendError(null);
    try {
      const handle = await agent.send(envelope);
      const materializedSessionKey =
        handle?.sessionId?.trim() ||
        agent.snapshot.activeRun?.sessionId?.trim() ||
        null;
      if (!sessionKey && materializedSessionKey) {
        onSessionMaterialized?.(materializedSessionKey);
      }
    } catch (error) {
      restoreComposer(draft.composerSnapshot);
      setSendError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, [
    agent,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    materializationContext,
    onSessionMaterialized,
    resetComposer,
    restoreComposer,
    selectedAgentId,
    sessionKey,
    setSendError,
  ]);

  const editQueuedInput = useCallback((id: string) => {
    const input = runQueue.inputs.find((item) => item.id === id);
    if (!input) {
      return;
    }
    void runQueue.removeQueuedInput(id).then((removed) => {
      if (!removed) {
        return;
      }
      restoreComposer(buildSessionQueuedInputComposerSnapshot(
        removed,
        inputQuery.skillRecords,
      ));
      setSendError(null);
    }).catch((error) => {
      setSendError(error instanceof Error ? error.message : String(error));
    });
  }, [inputQuery.skillRecords, restoreComposer, runQueue, setSendError]);

  const deleteQueuedInput = useCallback((id: string) => {
    void runQueue.removeQueuedInput(id).then(() => {
      setSendError(null);
    }).catch((error) => {
      setSendError(error instanceof Error ? error.message : String(error));
    });
  }, [runQueue, setSendError]);

  const stop = useCallback(async () => {
    await agent.abort();
  }, [agent]);

  return {
    canStopGeneration: agent.isRunning,
    deleteQueuedInput,
    editQueuedInput,
    hasSendableDraft,
    isSending,
    queuedInputs: runQueue.inputs.map((input) => ({
      id: input.id,
      preview: buildSessionQueuedInputPreview(input),
    })),
    send,
    sendDisabled,
    stop,
    stopDisabled: !agent.isRunning,
  };
}
