import { useCallback, type RefObject } from 'react';
import type { ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import { CHAT_SYSTEM_OBJECT_TOKEN_KIND } from '@nextclaw/shared';
import { toast } from 'sonner';

import { nextclawClient } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

export function useSystemObjectReferenceSelect(
  inputBarRef: RefObject<ChatInputBarHandle | null>,
) {
  return useCallback((uri: string) => {
    void nextclawClient.systemObjectReferences.resolve(uri)
      .then((reference) => {
        inputBarRef.current?.insertInputSurfaceToken({
          tokenKind: CHAT_SYSTEM_OBJECT_TOKEN_KIND,
          tokenKey: reference.uri,
          label: reference.label,
          data: { reference },
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : t('error');
        toast.error(`${t('chatSystemObjectResolveFailed')}: ${message}`);
      });
  }, [inputBarRef]);
}
