import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SessionEntryView, ThinkingLevel } from '@/shared/lib/api';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';

function normalizeSessionType(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || 'native';
}

function hasModelOption(modelOptions: ChatModelOption[], value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  return modelOptions.some((option) => option.value === normalized);
}

function hasThinkingLevelOption(levels: readonly ThinkingLevel[], value: unknown): value is ThinkingLevel {
  return typeof value === 'string' && levels.includes(value as ThinkingLevel);
}

function resolveFallbackThinkingLevel(levels: readonly ThinkingLevel[]): ThinkingLevel | null {
  return levels.length === 0 ? null : levels.includes('off') ? 'off' : (levels[0] ?? null);
}

type ResolveSessionPreferenceValueParams<T> = {
  currentValue: unknown;
  selectedSessionPreferredValue?: unknown;
  fallbackPreferredValue?: unknown;
  defaultValue?: unknown;
  isValueSupported: (value: unknown) => value is T;
  firstAvailableValue: T;
  preferSessionPreferredValue?: boolean;
  preserveCurrentValueOnSessionChange?: boolean;
};

export function resolveSessionPreferenceValue<T>(params: ResolveSessionPreferenceValueParams<T>): T {
  const {
    currentValue,
    selectedSessionPreferredValue,
    fallbackPreferredValue,
    defaultValue,
    isValueSupported,
    firstAvailableValue,
    preferSessionPreferredValue = false,
    preserveCurrentValueOnSessionChange = false
  } = params;
  if (isValueSupported(currentValue) && (!preferSessionPreferredValue || preserveCurrentValueOnSessionChange)) {
    return currentValue;
  }
  if (isValueSupported(selectedSessionPreferredValue)) {
    return selectedSessionPreferredValue;
  }
  if (isValueSupported(fallbackPreferredValue)) {
    return fallbackPreferredValue;
  }
  if (isValueSupported(defaultValue)) {
    return defaultValue;
  }
  return firstAvailableValue;
}

export function resolveSelectedModelValue(params: {
  currentSelectedModel?: string;
  modelOptions: ChatModelOption[];
  selectedSessionPreferredModel?: string;
  fallbackPreferredModel?: string;
  defaultModel?: string;
  preferSessionPreferredModel?: boolean;
  preserveCurrentSelectedModelOnSessionChange?: boolean;
}): string {
  const {
    modelOptions,
    currentSelectedModel,
    selectedSessionPreferredModel,
    fallbackPreferredModel,
    defaultModel,
    preferSessionPreferredModel,
    preserveCurrentSelectedModelOnSessionChange
  } = params;
  if (modelOptions.length === 0) {
    return '';
  }
  return resolveSessionPreferenceValue<string>({
    currentValue: currentSelectedModel,
    selectedSessionPreferredValue: selectedSessionPreferredModel,
    fallbackPreferredValue: fallbackPreferredModel,
    defaultValue: defaultModel,
    isValueSupported: (value): value is string => hasModelOption(modelOptions, value),
    firstAvailableValue: modelOptions[0]?.value ?? '',
    preferSessionPreferredValue: preferSessionPreferredModel,
    preserveCurrentValueOnSessionChange: preserveCurrentSelectedModelOnSessionChange
  });
}

export function resolveSelectedThinkingLevelValue(params: {
  currentSelectedThinkingLevel?: ThinkingLevel | null;
  supportedThinkingLevels: readonly ThinkingLevel[];
  selectedSessionPreferredThinking?: ThinkingLevel | null;
  fallbackPreferredThinking?: ThinkingLevel | null;
  defaultThinkingLevel?: ThinkingLevel | null;
  preferSessionPreferredThinking?: boolean;
  preserveCurrentSelectedThinkingOnSessionChange?: boolean;
}): ThinkingLevel | null {
  const {
    supportedThinkingLevels,
    currentSelectedThinkingLevel,
    selectedSessionPreferredThinking,
    fallbackPreferredThinking,
    defaultThinkingLevel,
    preferSessionPreferredThinking,
    preserveCurrentSelectedThinkingOnSessionChange
  } = params;
  if (supportedThinkingLevels.length === 0) {
    return null;
  }
  return resolveSessionPreferenceValue<ThinkingLevel>({
    currentValue: currentSelectedThinkingLevel,
    selectedSessionPreferredValue: selectedSessionPreferredThinking,
    fallbackPreferredValue: fallbackPreferredThinking,
    defaultValue: defaultThinkingLevel,
    isValueSupported: (value): value is ThinkingLevel => hasThinkingLevelOption(supportedThinkingLevels, value),
    firstAvailableValue: resolveFallbackThinkingLevel(supportedThinkingLevels) ?? 'off',
    preferSessionPreferredValue: preferSessionPreferredThinking,
    preserveCurrentValueOnSessionChange: preserveCurrentSelectedThinkingOnSessionChange
  });
}

export function resolveRecentSessionPreferredValue<T>(params: {
  sessions: readonly SessionEntryView[];
  selectedSessionKey?: string | null;
  sessionType?: string | null;
  readPreference: (session: SessionEntryView) => T | null | undefined;
}): T | undefined {
  const { sessions, selectedSessionKey, sessionType, readPreference } = params;
  const targetSessionType = normalizeSessionType(sessionType);
  let bestValue: T | undefined;
  let bestTimestamp = Number.NEGATIVE_INFINITY;
  for (const session of sessions) {
    if (session.key === selectedSessionKey) {
      continue;
    }
    if (normalizeSessionType(session.sessionType) !== targetSessionType) {
      continue;
    }
    const value = readPreference(session);
    if (value === null || value === undefined) {
      continue;
    }
    const updatedAtTimestamp = Date.parse(session.updatedAt);
    const comparableTimestamp = Number.isFinite(updatedAtTimestamp) ? updatedAtTimestamp : Number.NEGATIVE_INFINITY;
    if (bestValue === undefined || comparableTimestamp > bestTimestamp) {
      bestValue = value;
      bestTimestamp = comparableTimestamp;
    }
  }
  return bestValue;
}

export function resolveRecentSessionPreferredModel(params: {
  sessions: readonly SessionEntryView[];
  selectedSessionKey?: string | null;
  sessionType?: string | null;
}): string | undefined {
  const { sessions, selectedSessionKey, sessionType } = params;
  return resolveRecentSessionPreferredValue<string>({
    sessions,
    selectedSessionKey,
    sessionType,
    readPreference: (session) => session.preferredModel?.trim() || undefined
  });
}

export function resolveRecentSessionPreferredThinking(params: {
  sessions: readonly SessionEntryView[];
  selectedSessionKey?: string | null;
  sessionType?: string | null;
}): ThinkingLevel | undefined {
  const { sessions, selectedSessionKey, sessionType } = params;
  return resolveRecentSessionPreferredValue<ThinkingLevel>({
    sessions,
    selectedSessionKey,
    sessionType,
    readPreference: (session) => session.preferredThinking ?? undefined
  });
}

type UseSyncSessionPreferenceParams<T> = {
  isPreferenceAvailable: boolean;
  emptyValue: T;
  selectedSessionKey?: string | null;
  selectedSessionExists?: boolean;
  setValue: Dispatch<SetStateAction<T>>;
  resolveValue: (params: { currentValue: T; sessionChanged: boolean; preserveCurrentValueOnSessionChange: boolean }) => T;
};

function useSyncSessionPreference<T>(params: UseSyncSessionPreferenceParams<T>) {
  const {
    isPreferenceAvailable,
    emptyValue,
    selectedSessionKey,
    selectedSessionExists = false,
    setValue,
    resolveValue
  } = params;
  const previousSessionKeyRef = useRef<string | null | undefined>(undefined);
  const resolveValueRef = useRef(resolveValue);

  useEffect(() => {
    resolveValueRef.current = resolveValue;
  }, [resolveValue]);

  useEffect(() => {
    const sessionChanged = previousSessionKeyRef.current !== selectedSessionKey;
    if (!isPreferenceAvailable) {
      setValue(emptyValue);
      previousSessionKeyRef.current = selectedSessionKey;
      return;
    }
    setValue((prev) =>
      resolveValueRef.current({
        currentValue: prev,
        sessionChanged,
        preserveCurrentValueOnSessionChange: sessionChanged && Boolean(selectedSessionKey) && !selectedSessionExists
      })
    );
    previousSessionKeyRef.current = selectedSessionKey;
  }, [emptyValue, isPreferenceAvailable, selectedSessionExists, selectedSessionKey, setValue]);
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
