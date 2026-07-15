import { useCallback, useMemo, useRef } from 'react';

import type { ThinkingLevel } from '@/shared/lib/api';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import {
  resolveSelectedModelValue,
  resolveSelectedThinkingLevelValue,
} from '@/features/chat/features/session/utils/chat-session-preference-governance.utils';

type ConversationPreferenceValue = string | null | undefined;

export type SessionConversationPreferenceSyncParams = {
  readonly defaultModel?: string;
  readonly fallbackPreferredModel?: string;
  readonly fallbackPreferredThinking?: ThinkingLevel | null;
  readonly modelOptions: ChatModelOption[];
  readonly selectedSessionExists: boolean;
  readonly selectedSessionKey?: string | null;
  readonly selectedSessionPreferredModel?: string;
  readonly selectedSessionPreferredThinking?: ThinkingLevel | null;
};

type SessionConversationPreferenceActionsParams = {
  readonly selectedModel: ConversationPreferenceValue;
  readonly selectedThinkingLevel: ThinkingLevel | null;
  readonly updatePreferences: (patch: {
    readonly selectedModel?: ConversationPreferenceValue;
    readonly selectedThinkingLevel?: ThinkingLevel | null;
  }) => void;
};

export const useSessionConversationPreferenceActions = ({
  selectedModel: currentSelectedModel,
  selectedThinkingLevel: currentSelectedThinkingLevel,
  updatePreferences,
}: SessionConversationPreferenceActionsParams) => {
  const previousSessionKeyRef = useRef<string | null | undefined>(undefined);
  const setSelectedModel = useCallback((selectedModel: ConversationPreferenceValue) => {
    updatePreferences({ selectedModel });
  }, [updatePreferences]);
  const setSelectedThinkingLevel = useCallback((selectedThinkingLevel: ThinkingLevel | null) => {
    updatePreferences({ selectedThinkingLevel });
  }, [updatePreferences]);
  const syncSessionPreferences = useCallback(({
    defaultModel,
    fallbackPreferredModel,
    fallbackPreferredThinking,
    modelOptions,
    selectedSessionExists,
    selectedSessionKey: sessionKey,
    selectedSessionPreferredModel,
    selectedSessionPreferredThinking,
  }: SessionConversationPreferenceSyncParams) => {
    const selectedSessionKey = sessionKey ?? null;
    const sessionChanged = previousSessionKeyRef.current !== selectedSessionKey;
    const preserveCurrentPreference = sessionChanged && Boolean(selectedSessionKey) && !selectedSessionExists;
    const selectedModel = resolveSelectedModelValue({
      currentSelectedModel: currentSelectedModel ?? undefined,
      modelOptions,
      selectedSessionPreferredModel,
      fallbackPreferredModel,
      defaultModel,
      preferSessionPreferredModel: sessionChanged,
      preserveCurrentSelectedModelOnSessionChange: preserveCurrentPreference,
    });
    const modelOption = modelOptions.find((option) => option.value === selectedModel);
    const selectedThinkingLevel = resolveSelectedThinkingLevelValue({
      currentSelectedThinkingLevel,
      supportedThinkingLevels:
        (modelOption?.thinkingCapability?.supported as ThinkingLevel[] | undefined) ?? [],
      selectedSessionPreferredThinking,
      fallbackPreferredThinking,
      defaultThinkingLevel:
        (modelOption?.thinkingCapability?.default as ThinkingLevel | null | undefined) ?? null,
      preferSessionPreferredThinking: sessionChanged,
      preserveCurrentSelectedThinkingOnSessionChange: preserveCurrentPreference,
    });
    if (
      currentSelectedModel !== selectedModel ||
      currentSelectedThinkingLevel !== selectedThinkingLevel
    ) {
      updatePreferences({ selectedModel, selectedThinkingLevel });
    }
    if (!selectedSessionKey || selectedSessionExists) {
      previousSessionKeyRef.current = selectedSessionKey;
    }
  }, [currentSelectedModel, currentSelectedThinkingLevel, updatePreferences]);

  return useMemo(() => ({
    setSelectedModel,
    setSelectedThinkingLevel,
    syncSessionPreferences,
  }), [setSelectedModel, setSelectedThinkingLevel, syncSessionPreferences]);
};
