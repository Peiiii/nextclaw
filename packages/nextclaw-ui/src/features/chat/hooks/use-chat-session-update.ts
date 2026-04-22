import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SessionPatchUpdate } from '@/shared/lib/api';
import { updateNcpSession } from '@/shared/lib/api';
import { upsertNcpSessionSummaryInQueryClient } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

type UpdateChatSessionParams = {
  sessionKey: string;
  patch: SessionPatchUpdate;
  successMessage?: string;
};

export function useChatSessionUpdate() {
  const queryClient = useQueryClient();

  return async (params: UpdateChatSessionParams): Promise<void> => {
    const { sessionKey, patch, successMessage } = params;
    try {
      const updated = await updateNcpSession(sessionKey, patch);
      upsertNcpSessionSummaryInQueryClient(queryClient, updated);
      await queryClient.invalidateQueries({ queryKey: ['ncp-session-skills', sessionKey] });
      toast.success(successMessage ?? t('configSavedApplied'));
    } catch (error) {
      toast.error(t('configSaveFailed') + ': ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  };
}
