import { useCallback, useRef } from 'react';

import type { SessionPatchUpdate, ThinkingLevel } from '@/shared/lib/api';
import { useChatSessionUpdate } from '@/features/chat/features/session/hooks/use-chat-session-update';
import type {
  SessionConversationInputActions,
  SessionConversationInputSnapshot,
} from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';

type SessionPreferencePatch = Pick<
  SessionPatchUpdate,
  'preferredModel' | 'preferredThinking'
>;

type SessionPreferenceRollback = Pick<
  SessionConversationInputSnapshot,
  'selectedModel' | 'selectedThinkingLevel'
>;

function ownsField<T extends object>(value: T, field: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

export function useSessionConversationPreferencePersistence(params: {
  readonly inputActions: SessionConversationInputActions;
  readonly selectedSessionKey: string | null;
}) {
  const { inputActions, selectedSessionKey } = params;
  const updateSession = useChatSessionUpdate();
  const mutationSequenceRef = useRef(0);
  const latestMutationByFieldRef = useRef(new Map<string, number>());
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());

  return useCallback((
    patch: SessionPreferencePatch,
    optimistic: Partial<SessionPreferenceRollback>,
    rollback: Partial<SessionPreferenceRollback>,
  ) => {
    const sessionKey = selectedSessionKey?.trim();
    if (!sessionKey) {
      return;
    }

    const mutationId = ++mutationSequenceRef.current;
    const modelMutationKey = `${sessionKey}:model`;
    const thinkingMutationKey = `${sessionKey}:thinking`;
    if (ownsField(patch, 'preferredModel')) {
      latestMutationByFieldRef.current.set(modelMutationKey, mutationId);
    }
    if (ownsField(patch, 'preferredThinking')) {
      latestMutationByFieldRef.current.set(thinkingMutationKey, mutationId);
    }

    const operation = persistenceQueueRef.current.then(() => updateSession({
      invalidateSessionSkills: false,
      sessionKey,
      patch,
      successMessage: null,
    }));
    persistenceQueueRef.current = operation.catch(() => undefined);

    void operation.catch(() => {
      inputActions.update((current) => {
        const next: {
          selectedModel?: string | null | undefined;
          selectedThinkingLevel?: ThinkingLevel | null;
        } = {};
        if (
          ownsField(patch, 'preferredModel') &&
          latestMutationByFieldRef.current.get(modelMutationKey) === mutationId &&
          current.selectedModel === optimistic.selectedModel &&
          ownsField(rollback, 'selectedModel')
        ) {
          next.selectedModel = rollback.selectedModel;
        }
        if (
          ownsField(patch, 'preferredThinking') &&
          latestMutationByFieldRef.current.get(thinkingMutationKey) === mutationId &&
          current.selectedThinkingLevel === optimistic.selectedThinkingLevel &&
          ownsField(rollback, 'selectedThinkingLevel')
        ) {
          next.selectedThinkingLevel = rollback.selectedThinkingLevel;
        }
        return next;
      });
    });
  }, [inputActions, selectedSessionKey, updateSession]);
}
