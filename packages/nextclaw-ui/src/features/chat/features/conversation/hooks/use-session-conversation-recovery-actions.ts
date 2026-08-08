import { useCallback } from 'react';
import type { NcpMessage, NcpRunHandle } from '@nextclaw/ncp';
import type {
  AgentRunContinueIngressPayload,
  AgentRunEditMessageIngressPayload,
} from '@nextclaw/shared';

export type SessionConversationRecoveryAgent = {
  readonly isRunning: boolean;
  readonly isSending: boolean;
  readonly continueRun: (
    payload: AgentRunContinueIngressPayload,
  ) => Promise<NcpRunHandle>;
  readonly editMessage: (
    payload: AgentRunEditMessageIngressPayload,
  ) => Promise<NcpRunHandle>;
};

export type SessionConversationMessageEdit = {
  readonly message: NcpMessage;
  readonly messageId: string;
};

export function useSessionConversationRecoveryActions({
  agent,
  sessionKey,
  setSendError,
}: {
  readonly agent: SessionConversationRecoveryAgent;
  readonly sessionKey: string | null;
  readonly setSendError: (message: string | null) => void;
}) {
  const continueRun = useCallback(async () => {
    if (!sessionKey || agent.isSending || agent.isRunning) {
      return;
    }
    setSendError(null);
    try {
      await agent.continueRun({ sessionId: sessionKey });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, [agent, sessionKey, setSendError]);

  const editMessage = useCallback(async (payload: SessionConversationMessageEdit) => {
    if (!sessionKey || agent.isSending || agent.isRunning) {
      return;
    }
    setSendError(null);
    try {
      await agent.editMessage({
        message: payload.message,
        messageId: payload.messageId,
        sessionId: sessionKey,
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, [agent, sessionKey, setSendError]);

  return { continueRun, editMessage };
}
