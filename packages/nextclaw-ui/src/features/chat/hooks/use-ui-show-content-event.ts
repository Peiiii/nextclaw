import { useEffect } from 'react';
import { eventKeys } from '@nextclaw/shared';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { nextclawClient } from '@/shared/lib/api';

export function useUiShowContentEvent(): void {
  const presenter = usePresenter();

  useEffect(() => (
    nextclawClient.eventBus.on(eventKeys.uiShowContent, (payload) => {
      void presenter.chatThreadManager.handleUiShowContentEvent(payload);
    })
  ), [presenter]);
}
