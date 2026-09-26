import type { ChatComposerSubmission } from '@/features/chat/stores/chat-composer-draft.store';
import type { SessionConversationInputController } from '@/features/chat/features/conversation/types/session-conversation-input.types';
import type { SessionConversationInputSnapshot } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';
import { t } from '@/shared/lib/i18n';
import { SessionQueuedInputRows } from './session-queued-input-rows';

export function SessionConversationInputTopSlot({ inputSnapshot, controller }: {
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly controller: SessionConversationInputController;
}) {
  const submission = inputSnapshot.pendingSubmission;
  const needsRecovery = submission && submission.status !== 'sending';
  if (!needsRecovery && controller.queuedInputs.length === 0) return null;
  return <>
    {controller.queuedInputs.length > 0 && <SessionQueuedInputRows controller={controller} />}
    {needsRecovery && <SubmissionStatus submission={submission} controller={controller}
      hasComposerContent={Boolean(inputSnapshot.text.trim() || inputSnapshot.selectedSkills.length || inputSnapshot.attachments.length)} />}
  </>;
}

function SubmissionStatus({ submission, controller, hasComposerContent }: {
  readonly submission: ChatComposerSubmission;
  readonly controller: SessionConversationInputController;
  readonly hasComposerContent: boolean;
}) {
  const statusText = submission.status === 'rejected'
    ? t('chatSubmissionRejected')
    : t(submission.envelope.sessionId ? 'chatSendResultUnknown' : 'chatSendResultUnknownChild');
  return <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm" role="status">
    <p>{statusText}</p>
    <p className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap text-muted-foreground">{submission.composer.text}</p>
    <div className="mt-2 flex gap-3">
      {submission.status === 'uncertain' && submission.envelope.sessionId &&
        <button type="button" className="text-primary underline" onClick={controller.retryPendingSubmission}>{t('chatSubmissionRetry')}</button>}
      {submission.status === 'rejected' && <>
        <button type="button" className="text-primary underline" disabled={hasComposerContent} onClick={controller.restorePendingSubmission}>{t('chatSubmissionRestore')}</button>
        <button type="button" className="text-muted-foreground underline" onClick={() => {
          if (window.confirm(t('chatSubmissionDiscardConfirm'))) controller.discardPendingSubmission();
        }}>{t('chatSubmissionDiscard')}</button>
      </>}
    </div>
  </div>;
}
