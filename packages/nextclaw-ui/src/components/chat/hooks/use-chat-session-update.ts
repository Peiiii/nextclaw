import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SessionPatchUpdate } from '@/api/types';
import { upsertNcpSessionSummaryInQueryClient } from '@/api/ncp-session-query-cache';
import { updateNcpSession } from '@/api/ncp-session';
import { t } from '@/lib/i18n';

type UpdateChatSessionParams = {
  sessionKey: string;
  patch: SessionPatchUpdate;
  successMessage?: string;
};

export function useChatSessionUpdate() {
  const queryClient = useQueryClient();

  return async (params: UpdateChatSessionParams): Promise<void> => {
    try {
      const updated = await updateNcpSession(params.sessionKey, params.patch);
      upsertNcpSessionSummaryInQueryClient(queryClient, updated);
      toast.success(params.successMessage ?? t('configSavedApplied'));
    } catch (error) {
      toast.error(
        t('configSaveFailed') + ': ' + (error instanceof Error ? error.message : String(error)),
      );
      throw error;
    }
  };
}
