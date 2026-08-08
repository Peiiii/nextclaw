import { useEffect, type RefObject } from 'react';
import { type ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import { CHAT_WORKSPACE_FILE_TOKEN_KIND } from '@nextclaw/shared';

import type {
  ChatComposerFileReferenceIntent,
  ChatComposerIntentManager,
} from '@/features/chat/managers/chat-composer-intent.manager';

export function useChatComposerFileReferenceIntent(params: {
  inputBarRef: RefObject<ChatInputBarHandle | null>;
  intentManager: ChatComposerIntentManager;
  selectedSessionKey: string | null | undefined;
}): void {
  const { inputBarRef, intentManager, selectedSessionKey } = params;

  useEffect(() => {
    const targetSessionKey = selectedSessionKey?.trim() || null;
    const applyIntent = (intent: ChatComposerFileReferenceIntent) => {
      const inputBar = inputBarRef.current;
      if (!inputBar) {
        return;
      }
      inputBar.insertToken({
        tokenKind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
        tokenKey: intent.tokenKey,
        label: intent.label,
      });
      intentManager.markConsumed(intent.id);
    };
    const unsubscribe = intentManager.subscribe(targetSessionKey, applyIntent);
    const pendingIntent = intentManager.consumePending(targetSessionKey);
    if (pendingIntent) {
      applyIntent(pendingIntent);
    }
    return unsubscribe;
  }, [inputBarRef, intentManager, selectedSessionKey]);
}
