import { toast } from 'sonner';
import { t } from '@/lib/i18n';
import { useChatSessionUpdate } from '@/components/chat/hooks/use-chat-session-update';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';

type UpdateChatSessionProjectParams = {
  sessionKey: string;
  projectRoot: string | null;
  persistToServer: boolean;
};

export function useChatSessionProject() {
  const updateSession = useChatSessionUpdate();

  return async (params: UpdateChatSessionProjectParams): Promise<void> => {
    const successMessage = params.projectRoot
      ? t('chatSessionProjectUpdated')
      : t('chatSessionProjectCleared');

    if (!params.persistToServer) {
      useChatInputStore.getState().setSnapshot({
        pendingProjectRoot: params.projectRoot,
        pendingProjectRootSessionKey: params.projectRoot ? params.sessionKey : null
      });
      toast.success(successMessage);
      return;
    }

    await updateSession({
      sessionKey: params.sessionKey,
      patch: { projectRoot: params.projectRoot },
      successMessage,
    });
  };
}
