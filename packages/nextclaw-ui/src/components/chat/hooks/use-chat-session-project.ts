import { t } from '@/lib/i18n';
import { useChatSessionUpdate } from '@/components/chat/hooks/use-chat-session-update';

type UpdateChatSessionProjectParams = {
  sessionKey: string;
  projectRoot: string | null;
};

export function useChatSessionProject() {
  const updateSession = useChatSessionUpdate();

  return async (params: UpdateChatSessionProjectParams): Promise<void> => {
    await updateSession({
      sessionKey: params.sessionKey,
      patch: { projectRoot: params.projectRoot },
      successMessage: params.projectRoot
        ? t('chatSessionProjectUpdated')
        : t('chatSessionProjectCleared'),
    });
  };
}
