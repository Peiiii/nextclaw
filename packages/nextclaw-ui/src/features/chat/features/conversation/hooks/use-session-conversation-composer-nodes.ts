import { useCallback } from 'react';

import type {
  SessionConversationInputActions,
  SessionConversationInputSnapshot,
} from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';
import {
  deriveChatComposerDraft,
  deriveSelectedSkillsFromComposer,
  pruneComposerAttachments,
} from '@/features/chat/features/input/utils/chat-composer-state.utils';

export function useSessionConversationComposerNodes(
  inputActions: SessionConversationInputActions,
) {
  return useCallback((nodes: SessionConversationInputSnapshot['nodes']) => {
    const nextNodes = [...nodes];
    inputActions.update((current) => ({
      nodes: nextNodes,
      attachments: pruneComposerAttachments(nextNodes, current.attachments),
      text: deriveChatComposerDraft(nextNodes),
      selectedSkills: deriveSelectedSkillsFromComposer(nextNodes),
      sendError: null,
    }));
  }, [inputActions]);
}
