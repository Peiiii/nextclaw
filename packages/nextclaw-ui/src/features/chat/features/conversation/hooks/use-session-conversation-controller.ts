import { useCallback, useMemo } from 'react';
import { buildNcpRequestEnvelope } from '@nextclaw/ncp-react';
import type { NcpAgentSendEnvelope, NcpMessage, NcpRunHandle } from '@nextclaw/ncp';

import { deriveNcpMessagePartsFromComposer } from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { isNcpChatSendDisabled } from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';
import { buildChatRunMetadata } from '@/features/chat/features/session/utils/chat-run-metadata.utils';
import type { SessionConversationInputSnapshot } from './use-session-conversation-input-state';
import type { useSessionConversationInputQuery } from './use-session-conversation-input-query';

type SessionConversationInputQuery = ReturnType<typeof useSessionConversationInputQuery>;

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
  readonly send: (envelope: NcpAgentSendEnvelope) => Promise<NcpRunHandle | null>;
  readonly abort: () => Promise<void>;
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
  readonly restoreComposer: (snapshot: Pick<
    SessionConversationInputSnapshot,
    'text' | 'nodes' | 'selectedSkills' | 'skillRecords' | 'attachments'
  >) => void;
  readonly setSendError: (message: string | null) => void;
};

const hasSendableMessagePart = (parts: ReturnType<typeof deriveNcpMessagePartsFromComposer>): boolean =>
  parts.some((part) => part.type !== 'text' || part.text.trim().length > 0);

const resolveModelForSend = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

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
  const sendDisabled = isNcpChatSendDisabled({
    snapshot: {
      isProviderStateResolved: inputQuery.isProviderStateResolved,
      modelOptions: inputQuery.modelOptions,
      sessionTypeUnavailable: inputQuery.sessionTypeState.sessionTypeUnavailable,
    },
    hasSendableDraft,
    isRuntimeBlocked,
  }) || isSending;
  const send = useCallback(async () => {
    const currentParts = deriveNcpMessagePartsFromComposer(
      [...inputSnapshot.nodes],
      inputSnapshot.attachments,
    );
    if (
      isNcpChatSendDisabled({
        snapshot: {
          isProviderStateResolved: inputQuery.isProviderStateResolved,
          modelOptions: inputQuery.modelOptions,
          sessionTypeUnavailable: inputQuery.sessionTypeState.sessionTypeUnavailable,
        },
        hasSendableDraft: hasSendableMessagePart(currentParts),
        isRuntimeBlocked,
      }) ||
      isSending
    ) {
      return;
    }
    const composerSnapshot = {
      text: inputSnapshot.text,
      nodes: inputSnapshot.nodes,
      selectedSkills: inputSnapshot.selectedSkills,
      skillRecords: inputSnapshot.skillRecords,
      attachments: inputSnapshot.attachments,
    };
    const metadata = buildChatRunMetadata({
      agentId: materializationContext ? undefined : selectedAgentId,
      model: materializationContext
        ? resolveModelForSend(inputSnapshot.selectedModel)
        : resolveModelForSend(inputSnapshot.selectedModel ?? inputQuery.fallbackPreferredModel ?? inputQuery.defaultModel),
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
    const envelope = buildNcpRequestEnvelope({
      sessionId: sessionKey ?? undefined,
      text: inputSnapshot.text.trim(),
      attachments: [...inputSnapshot.attachments],
      parts: currentParts,
      metadata,
    });
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
      restoreComposer(composerSnapshot);
      const message = error instanceof Error ? error.message : String(error);
      setSendError(message);
      throw error;
    }
  }, [
    agent,
    inputQuery,
    inputSnapshot,
    isRuntimeBlocked,
    isSending,
    materializationContext,
    onSessionMaterialized,
    resetComposer,
    restoreComposer,
    selectedAgentId,
    sessionKey,
    setSendError,
  ]);

  const stop = useCallback(async () => {
    await agent.abort();
  }, [agent]);

  return {
    canStopGeneration: agent.isRunning,
    hasSendableDraft,
    isSending,
    send,
    sendDisabled,
    stop,
    stopDisabled: !agent.isRunning,
  };
}
