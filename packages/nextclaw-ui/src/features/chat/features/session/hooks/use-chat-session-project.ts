import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';
import { useChatSessionUpdate } from '@/features/chat/features/session/hooks/use-chat-session-update';

type UpdateChatSessionProjectParams = {
  sessionKey: string;
  projectRoot: string | null;
  persistToServer: boolean;
};

export function useChatSessionProject() {
  const updateSession = useChatSessionUpdate();

  return async (params: UpdateChatSessionProjectParams): Promise<void> => {
    const { persistToServer, projectRoot, sessionKey } = params;
    const successMessage = projectRoot ? t('chatSessionProjectUpdated') : t('chatSessionProjectCleared');

    if (!persistToServer) {
      toast.success(successMessage);
      return;
    }

    await updateSession({
      sessionKey,
      patch: { projectRoot },
      successMessage
    });
  };
}
