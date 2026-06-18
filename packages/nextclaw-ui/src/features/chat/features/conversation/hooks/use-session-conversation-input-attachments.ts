import { useCallback, type ChangeEvent, type RefObject } from 'react';
import type { ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import {
  DEFAULT_NCP_ATTACHMENT_MAX_BYTES,
  uploadFilesAsNcpDraftAttachments,
} from '@nextclaw/ncp-react';
import { toast } from 'sonner';

import { uploadNcpAssets } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import type { SessionConversationInputActions } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';

type UseSessionConversationInputAttachmentsParams = {
  readonly attachmentSupported: boolean;
  readonly inputBarRef: RefObject<ChatInputBarHandle | null>;
  readonly addAttachments: SessionConversationInputActions['addAttachments'];
};

export function useSessionConversationInputAttachments(params: UseSessionConversationInputAttachmentsParams) {
  const { addAttachments, attachmentSupported, inputBarRef } = params;
  const showAttachmentError = useCallback((reason: 'unsupported-type' | 'too-large' | 'read-failed') => {
    if (reason === 'unsupported-type') {
      toast.error(t('chatInputAttachmentUnsupported'));
      return;
    }
    if (reason === 'too-large') {
      toast.error(
        t('chatInputAttachmentTooLarge').replace(
          '{maxMb}',
          String(DEFAULT_NCP_ATTACHMENT_MAX_BYTES / (1024 * 1024)),
        ),
      );
      return;
    }
    toast.error(t('chatInputAttachmentReadFailed'));
  }, []);
  const handleFilesAdd = useCallback(async (files: File[]) => {
    if (!attachmentSupported || files.length === 0) {
      return;
    }
    const result = await uploadFilesAsNcpDraftAttachments(files, { uploadBatch: uploadNcpAssets });
    if (result.attachments.length > 0) {
      const insertedAttachments = addAttachments(result.attachments);
      if (insertedAttachments.length > 0) {
        inputBarRef.current?.insertFileTokens(
          insertedAttachments.map((attachment) => ({
            tokenKey: attachment.id,
            label: attachment.name,
          })),
        );
      }
    }
    if (result.rejected.length > 0) {
      showAttachmentError(result.rejected[0].reason);
    }
  }, [addAttachments, attachmentSupported, inputBarRef, showAttachmentError]);

  return {
    handleFilesAdd,
    handleFileInputChange: useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.currentTarget.value = '';
      await handleFilesAdd(files);
    }, [handleFilesAdd]),
  };
}
