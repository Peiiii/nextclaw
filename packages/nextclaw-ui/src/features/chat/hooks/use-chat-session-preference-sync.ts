import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ThinkingLevel } from '@/shared/lib/api';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import {
  resolveSelectedModelValue,
  resolveSelectedThinkingLevelValue
} from '@/features/chat/utils/chat-session-preference-governance.utils';

function buildSyncKey(parts: unknown[]): string {
  return parts.map((part) => (part == null ? '' : String(part))).join('\u0002');
}

type UseSyncSessionPreferenceParams<T> = {
  isPreferenceAvailable: boolean;
  emptyValue: T;
  syncKey: string;
  selectedSessionKey?: string | null;
  selectedSessionExists?: boolean;
  setValue: Dispatch<SetStateAction<T>>;
  resolveValue: (params: { currentValue: T; sessionChanged: boolean; preserveCurrentValueOnSessionChange: boolean }) => T;
};

function useSyncSessionPreference<T>(params: UseSyncSessionPreferenceParams<T>) {
  const {
    isPreferenceAvailable,
    emptyValue,
    syncKey,
    selectedSessionKey,
    selectedSessionExists = false,
    setValue,
    resolveValue
  } = params;
  const previousSessionKeyRef = useRef<string | null | undefined>(undefined);
  const resolveValueRef = useRef(resolveValue);
  const lastSyncedValueRef = useRef<T>(emptyValue);

  useEffect(() => {
    resolveValueRef.current = resolveValue;
  }, [resolveValue]);

  useEffect(() => {
    const sessionChanged = previousSessionKeyRef.current !== selectedSessionKey;
    if (!isPreferenceAvailable) {
      setValue(emptyValue);
      lastSyncedValueRef.current = emptyValue;
      previousSessionKeyRef.current = selectedSessionKey;
      return;
    }
    setValue((prev) => {
      const next = resolveValueRef.current({
        currentValue:
          !sessionChanged && Object.is(prev, lastSyncedValueRef.current)
            ? emptyValue
            : prev,
        sessionChanged,
        preserveCurrentValueOnSessionChange: sessionChanged && Boolean(selectedSessionKey) && !selectedSessionExists
      });
      lastSyncedValueRef.current = next;
      return next;
    });
    previousSessionKeyRef.current = selectedSessionKey;
  }, [emptyValue, isPreferenceAvailable, selectedSessionExists, selectedSessionKey, setValue, syncKey]);
}

export function useSyncSelectedModel(params: {
  modelOptions: ChatModelOption[];
  selectedSessionKey?: string | null;
  selectedSessionExists?: boolean;
  selectedSessionPreferredModel?: string;
  fallbackPreferredModel?: string;
  defaultModel?: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
}) {
  const { modelOptions, selectedSessionKey, selectedSessionExists = false, selectedSessionPreferredModel, fallbackPreferredModel, defaultModel, setSelectedModel } = params;
  useSyncSessionPreference<string>({
    isPreferenceAvailable: modelOptions.length > 0,
    emptyValue: '',
    syncKey: buildSyncKey([
      modelOptions.map((option) => option.value).join('\u0001'),
      selectedSessionPreferredModel,
      fallbackPreferredModel,
      defaultModel
    ]),
    selectedSessionKey,
    selectedSessionExists,
    setValue: setSelectedModel,
    resolveValue: ({ currentValue, sessionChanged, preserveCurrentValueOnSessionChange }) =>
      resolveSelectedModelValue({
        currentSelectedModel: currentValue,
        modelOptions,
        selectedSessionPreferredModel,
        fallbackPreferredModel,
        defaultModel,
        preferSessionPreferredModel: sessionChanged,
        preserveCurrentSelectedModelOnSessionChange: preserveCurrentValueOnSessionChange
      })
  });
}

export function useSyncSelectedThinking(params: {
  supportedThinkingLevels: readonly ThinkingLevel[];
  selectedSessionKey?: string | null;
  selectedSessionExists?: boolean;
  selectedSessionPreferredThinking?: ThinkingLevel | null;
  fallbackPreferredThinking?: ThinkingLevel | null;
  defaultThinkingLevel?: ThinkingLevel | null;
  setSelectedThinkingLevel: Dispatch<SetStateAction<ThinkingLevel | null>>;
}) {
  const { supportedThinkingLevels, selectedSessionKey, selectedSessionExists = false, selectedSessionPreferredThinking, fallbackPreferredThinking, defaultThinkingLevel, setSelectedThinkingLevel } = params;
  useSyncSessionPreference<ThinkingLevel | null>({
    isPreferenceAvailable: supportedThinkingLevels.length > 0,
    emptyValue: null,
    syncKey: buildSyncKey([
      supportedThinkingLevels.join('\u0001'),
      selectedSessionPreferredThinking,
      fallbackPreferredThinking,
      defaultThinkingLevel
    ]),
    selectedSessionKey,
    selectedSessionExists,
    setValue: setSelectedThinkingLevel,
    resolveValue: ({ currentValue, sessionChanged, preserveCurrentValueOnSessionChange }) =>
      resolveSelectedThinkingLevelValue({
        currentSelectedThinkingLevel: currentValue,
        supportedThinkingLevels,
        selectedSessionPreferredThinking,
        fallbackPreferredThinking,
        defaultThinkingLevel,
        preferSessionPreferredThinking: sessionChanged,
        preserveCurrentSelectedThinkingOnSessionChange: preserveCurrentValueOnSessionChange
      })
  });
}
