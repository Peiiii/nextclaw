import { t } from '@/lib/i18n';
import { useChatSessionUpdate } from '@/features/chat/hooks/use-chat-session-update';

type UpdateChatSessionLabelParams = {
  sessionKey: string;
  label: string | null;
};
export function useChatSessionLabel() {
  const updateSession = useChatSessionUpdate();

  return async (params: UpdateChatSessionLabelParams): Promise<void> => {
    await updateSession({
      sessionKey: params.sessionKey,
      patch: { label: params.label },
      successMessage: t('configSavedApplied')
    });
  };
}
