import { useCallback, useEffect, useRef } from 'react';
import type { NcpAgentSendEnvelope, NcpRunHandle } from '@nextclaw/ncp';
import { NcpHttpSendError } from '@nextclaw/ncp-http-agent-client';
import { fetchNcpSessionMessages } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import type { ChatComposerSubmission } from '@/features/chat/stores/chat-composer-draft.store';

async function hasAcceptedSubmission(submission: ChatComposerSubmission): Promise<boolean> {
  const sessionId = submission.envelope.sessionId?.trim();
  if (!sessionId) return false;
  try {
    const response = await fetchNcpSessionMessages(sessionId, { limit: 100 });
    return response.messages.some((message) => message.id === submission.envelope.message.id);
  } catch {
    return false;
  }
}

export function useSessionSubmissionRecovery(params: {
  readonly agent: { send: (envelope: NcpAgentSendEnvelope) => Promise<NcpRunHandle | null> };
  readonly submission?: ChatComposerSubmission | null;
  readonly sessionKey: string | null;
  readonly onSessionMaterialized?: (sessionKey: string) => void;
  readonly acceptSubmission: (messageId: string) => void;
  readonly failSubmission: (messageId: string, status: 'uncertain' | 'rejected', message: string) => void;
  readonly restoreSubmission: (messageId: string) => void;
  readonly discardSubmission: (messageId: string) => void;
  readonly setSendError: (message: string | null) => void;
}) {
  const {
    agent, submission, sessionKey, onSessionMaterialized,
    acceptSubmission, failSubmission, restoreSubmission, discardSubmission, setSendError,
  } = params;
  const retryPendingSubmission = useCallback(async () => {
    if (!submission || submission.status !== 'uncertain') return;
    const { envelope } = submission;
    if (await hasAcceptedSubmission(submission)) {
      acceptSubmission(envelope.message.id);
      if (!sessionKey && envelope.sessionId) onSessionMaterialized?.(envelope.sessionId);
      return;
    }
    if (!envelope.sessionId) {
      setSendError(t('chatSendResultUnknownChild'));
      return;
    }
    try {
      const handle = await agent.send(envelope);
      if (!handle) throw new Error(t('chatSendFailed'));
      acceptSubmission(envelope.message.id);
      if (!sessionKey) onSessionMaterialized?.(handle.sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failSubmission(envelope.message.id,
        error instanceof NcpHttpSendError && error.sendRejected ? 'rejected' : 'uncertain',
        message);
    }
  }, [acceptSubmission, agent, failSubmission, onSessionMaterialized, sessionKey, setSendError, submission]);

  const checkedSubmissionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!submission || submission.status !== 'uncertain' ||
      checkedSubmissionRef.current === submission.envelope.message.id) return;
    checkedSubmissionRef.current = submission.envelope.message.id;
    void hasAcceptedSubmission(submission).then((accepted) => {
      if (accepted) {
        acceptSubmission(submission.envelope.message.id);
        if (!sessionKey && submission.envelope.sessionId) {
          onSessionMaterialized?.(submission.envelope.sessionId);
        }
      }
    });
  }, [acceptSubmission, onSessionMaterialized, sessionKey, submission]);

  return {
    retryPendingSubmission,
    restorePendingSubmission: () => {
      if (submission) restoreSubmission(submission.envelope.message.id);
    },
    discardPendingSubmission: () => {
      if (submission?.status === 'rejected') discardSubmission(submission.envelope.message.id);
    },
  };
}
