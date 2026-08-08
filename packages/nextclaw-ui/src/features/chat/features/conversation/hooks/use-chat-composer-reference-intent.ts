import { useEffect, type RefObject } from 'react';
import { type ChatInputBarHandle } from '@nextclaw/agent-chat-ui';
import { CHAT_WORKSPACE_EXCERPT_TOKEN_KIND } from '@nextclaw/shared';

import type {
  ChatComposerIntentManager,
  ChatComposerReferenceIntent,
} from '@/features/chat/managers/chat-composer-intent.manager';

export function useChatComposerReferenceIntent(params: {
  inputBarRef: RefObject<ChatInputBarHandle | null>;
  intentManager: ChatComposerIntentManager;
  selectedSessionKey: string | null | undefined;
}): void {
  const { inputBarRef, intentManager, selectedSessionKey } = params;

  useEffect(() => {
    const targetSessionKey = selectedSessionKey?.trim() || null;
    const applyIntent = (intent: ChatComposerReferenceIntent) => {
      const inputBar = inputBarRef.current;
      if (!inputBar) {
        return;
      }
      inputBar.insertToken({
        tokenKind: intent.kind,
        tokenKey: intent.tokenKey,
        label: intent.label,
        data: intent.kind === CHAT_WORKSPACE_EXCERPT_TOKEN_KIND
          ? {
              path: intent.path,
              excerpt: intent.excerpt,
              startLine: intent.startLine,
              endLine: intent.endLine,
            }
          : undefined,
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
