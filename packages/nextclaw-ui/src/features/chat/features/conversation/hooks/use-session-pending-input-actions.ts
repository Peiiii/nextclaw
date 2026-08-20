import { useCallback, useMemo, useState } from 'react';
import type {
  UiNcpSessionPendingInputView,
  UiNcpSessionQueuedInputView,
} from '@nextclaw/client-sdk';
import type { NcpAgentSendEnvelope } from '@nextclaw/ncp';

import { t } from '@/shared/lib/i18n';
import {
  buildSessionQueuedInputComposerSnapshot,
  buildSessionQueuedInputPresentation,
  type SessionQueuedInputAttachmentPreview,
} from '@/features/chat/features/conversation/utils/session-queued-input.utils';
import type { SessionConversationInputSnapshot } from './use-session-conversation-input-state';

type ComposerDraftSnapshot = Pick<
  SessionConversationInputSnapshot,
  'text' | 'nodes' | 'selectedSkills' | 'skillRecords' | 'attachments'
>;

type SessionRunQueue = {
  readonly inputs: readonly UiNcpSessionQueuedInputView[];
  readonly removeQueuedInput: (id: string) => Promise<UiNcpSessionQueuedInputView | null>;
  readonly steerQueuedInput: (id: string) => Promise<UiNcpSessionPendingInputView | null>;
};

export type SubmittingQueuedInput = {
  readonly attachments: readonly SessionQueuedInputAttachmentPreview[];
  readonly id: string;
  readonly preview: string;
  readonly sessionId: string;
  readonly userMessageId: string;
};

type ProjectedQueuedInput = {
  readonly attachments: readonly SessionQueuedInputAttachmentPreview[];
  readonly id: string;
  readonly isSubmitting?: boolean;
  readonly preview: string;
};

function buildSubmittingQueuedInput(
  envelope: NcpAgentSendEnvelope,
): SubmittingQueuedInput | null {
  const sessionId = envelope.sessionId?.trim();
  if (!sessionId) return null;
  const input: UiNcpSessionQueuedInputView = {
    id: `submitting-${envelope.message.id}`,
    sessionId,
    enqueuedAt: new Date().toISOString(),
    message: { ...envelope.message, sessionId },
    metadata: structuredClone(envelope.metadata ?? {}),
  };
  const presentation = buildSessionQueuedInputPresentation(input);
  return {
    attachments: presentation.attachments,
    id: input.id,
    preview: presentation.preview,
    sessionId,
    userMessageId: input.message.id,
  };
}

export function useSubmittingQueuedInputProjection(
  serverInputs: readonly UiNcpSessionQueuedInputView[],
  sessionKey: string | null,
) {
  const [submittingInput, setSubmittingInput] = useState<SubmittingQueuedInput | null>(null);
  const stageSubmittingInput = useCallback((envelope: NcpAgentSendEnvelope) => {
    const input = buildSubmittingQueuedInput(envelope);
    if (input) setSubmittingInput(input);
    return input;
  }, []);
  const clearSubmittingInput = useCallback((input: SubmittingQueuedInput) => {
    setSubmittingInput((current) =>
      current?.userMessageId === input.userMessageId ? null : current
    );
  }, []);
  const queuedInputs = useMemo(() => {
    const projected: ProjectedQueuedInput[] = serverInputs.map((input) => ({
      ...buildSessionQueuedInputPresentation(input),
      id: input.id,
    }));
    if (
      submittingInput?.sessionId === sessionKey &&
      !serverInputs.some((input) => input.message.id === submittingInput.userMessageId)
    ) {
      projected.push({
        attachments: submittingInput.attachments,
        id: submittingInput.id,
        isSubmitting: true,
        preview: submittingInput.preview,
      });
    }
    return projected;
  }, [serverInputs, sessionKey, submittingInput]);
  return { clearSubmittingInput, queuedInputs, stageSubmittingInput };
}

export function useQueuedInputActions(params: {
  readonly availableSkills: readonly { ref: string; name: string }[];
  readonly hasComposerContent: boolean;
  readonly restoreComposer: (snapshot: ComposerDraftSnapshot) => void;
  readonly runQueue: SessionRunQueue;
  readonly setSendError: (message: string | null) => void;
}) {
  const { availableSkills, hasComposerContent, restoreComposer, runQueue, setSendError } = params;
  const editQueuedInput = useCallback((id: string) => {
    if (hasComposerContent) {
      setSendError(t('chatQueuedEditComposerNotEmpty'));
      return;
    }
    if (!runQueue.inputs.some((item) => item.id === id)) return;
    void runQueue.removeQueuedInput(id).then((removed) => {
      if (!removed) return;
      restoreComposer(buildSessionQueuedInputComposerSnapshot(removed, availableSkills));
      setSendError(null);
    }).catch((error) => {
      setSendError(error instanceof Error ? error.message : String(error));
    });
  }, [availableSkills, hasComposerContent, restoreComposer, runQueue, setSendError]);
  const deleteQueuedInput = useCallback((id: string) => {
    void runQueue.removeQueuedInput(id).then(() => setSendError(null)).catch((error) => {
      setSendError(error instanceof Error ? error.message : String(error));
    });
  }, [runQueue, setSendError]);
  const steerQueuedInput = useCallback((id: string) => {
    void runQueue.steerQueuedInput(id).then((steered) => {
      if (steered) setSendError(null);
    }).catch((error) => {
      setSendError(error instanceof Error ? error.message : String(error));
    });
  }, [runQueue, setSendError]);
  return { deleteQueuedInput, editQueuedInput, steerQueuedInput };
}
