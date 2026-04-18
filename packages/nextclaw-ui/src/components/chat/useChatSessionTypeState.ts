import { useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AgentProfileView,
  ChatSessionTypeOptionView,
  SessionEntryView,
  SessionTypeIconView
} from '@/api/types';
import { t } from '@/lib/i18n';

export const DEFAULT_SESSION_TYPE = 'native';

export type ChatSessionTypeOption = {
  value: string;
  label: string;
  icon: SessionTypeIconView | null;
  ready: boolean;
  reason?: string | null;
  reasonMessage?: string | null;
  supportedModels?: string[];
  recommendedModel?: string | null;
  cta?: {
    kind: string;
    label?: string;
    href?: string;
  } | null;
};

type UseChatSessionTypeStateParams = {
  selectedSession: SessionEntryView | null;
  pendingSessionType: string;
  setPendingSessionType: Dispatch<SetStateAction<string>>;
  sessionTypesData?: {
    defaultType?: string;
    options?: ChatSessionTypeOptionView[];
  } | null;
};

export function normalizeSessionType(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_SESSION_TYPE;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || DEFAULT_SESSION_TYPE;
}

export function resolveAgentRuntimeSessionType(
  agent: Pick<AgentProfileView, 'runtime' | 'engine'> | null | undefined,
  fallbackSessionType: string = DEFAULT_SESSION_TYPE
): string {
  const runtime = agent?.runtime?.trim() || agent?.engine?.trim() || fallbackSessionType;
  return normalizeSessionType(runtime);
}

export function resolveSessionTypeLabel(sessionType: string, fallbackLabel?: string): string {
  if (sessionType === 'native') {
    return t('chatSessionTypeNative');
  }
  const normalizedFallback = fallbackLabel?.trim();
  if (normalizedFallback) {
    return normalizedFallback;
  }
  return sessionType
    .trim()
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || sessionType;
}

export function buildSessionTypeOptions(
  options: ChatSessionTypeOptionView[]
): ChatSessionTypeOption[] {
  const deduped = new Map<string, ChatSessionTypeOption>();
  for (const option of options) {
    const value = normalizeSessionType(option.value);
    deduped.set(value, {
      value,
      label: option.label?.trim() || resolveSessionTypeLabel(value),
      icon: option.icon ?? null,
      ready: option.ready ?? true,
      reason: option.reason ?? null,
      reasonMessage: option.reasonMessage ?? null,
      supportedModels: option.supportedModels,
      recommendedModel: option.recommendedModel ?? null,
      cta: option.cta ?? null
    });
  }
  if (!deduped.has(DEFAULT_SESSION_TYPE)) {
    deduped.set(DEFAULT_SESSION_TYPE, {
      value: DEFAULT_SESSION_TYPE,
      label: resolveSessionTypeLabel(DEFAULT_SESSION_TYPE),
      icon: null,
      ready: true,
      reason: null,
      reasonMessage: null,
      supportedModels: undefined,
      recommendedModel: null,
      cta: null
    });
  }
  return Array.from(deduped.values()).sort((left, right) => {
    if (left.value === DEFAULT_SESSION_TYPE) {
      return -1;
    }
    if (right.value === DEFAULT_SESSION_TYPE) {
      return 1;
    }
    return left.value.localeCompare(right.value);
  });
}

export function useChatSessionTypeState(params: UseChatSessionTypeStateParams): {
  sessionTypeOptions: ChatSessionTypeOption[];
  selectedSessionTypeOption: ChatSessionTypeOption | null;
  defaultSessionType: string;
  selectedSessionType: string;
  canEditSessionType: boolean;
  sessionTypeUnavailable: boolean;
  sessionTypeUnavailableMessage: string | null;
} {
  const {
    selectedSession,
    pendingSessionType,
    setPendingSessionType,
    sessionTypesData
  } = params;

  const runtimeSessionTypeOptions = useMemo(
    () => buildSessionTypeOptions(sessionTypesData?.options ?? []),
    [sessionTypesData?.options]
  );
  const sessionTypeOptions = useMemo(() => {
    const options = [...runtimeSessionTypeOptions];
    const currentSessionType = normalizeSessionType(selectedSession?.sessionType);
    if (!options.some((option) => option.value === currentSessionType)) {
      options.push({
        value: currentSessionType,
        label: resolveSessionTypeLabel(currentSessionType),
        icon: null,
        ready: true,
        reason: null,
        reasonMessage: null,
        supportedModels: undefined,
        recommendedModel: null,
        cta: null
      });
    }
    return options.sort((left, right) => {
      if (left.value === DEFAULT_SESSION_TYPE) {
        return -1;
      }
      if (right.value === DEFAULT_SESSION_TYPE) {
        return 1;
      }
      return left.value.localeCompare(right.value);
    });
  }, [runtimeSessionTypeOptions, selectedSession?.sessionType]);
  const defaultSessionType = useMemo(
    () => normalizeSessionType(sessionTypesData?.defaultType ?? DEFAULT_SESSION_TYPE),
    [sessionTypesData?.defaultType]
  );
  const lastAutoPendingSessionTypeRef = useRef<string | null>(null);
  const selectedSessionType = useMemo(
    () => normalizeSessionType(selectedSession?.sessionType ?? pendingSessionType ?? defaultSessionType),
    [defaultSessionType, pendingSessionType, selectedSession?.sessionType]
  );
  const selectedSessionTypeOption = useMemo(
    () => sessionTypeOptions.find((option) => option.value === selectedSessionType) ?? null,
    [selectedSessionType, sessionTypeOptions]
  );

  useEffect(() => {
    if (selectedSession) {
      return;
    }
    const rawPending = typeof pendingSessionType === 'string' ? pendingSessionType.trim() : '';
    const normalizedPending = normalizeSessionType(pendingSessionType);
    const shouldFollowDefault =
      rawPending.length === 0 ||
      lastAutoPendingSessionTypeRef.current === normalizedPending ||
      (lastAutoPendingSessionTypeRef.current === null && normalizedPending === DEFAULT_SESSION_TYPE);
    if (!shouldFollowDefault) {
      return;
    }
    lastAutoPendingSessionTypeRef.current = defaultSessionType;
    if (normalizedPending === defaultSessionType) {
      return;
    }
    setPendingSessionType(defaultSessionType);
  }, [defaultSessionType, pendingSessionType, selectedSession, setPendingSessionType]);

  const canEditSessionType = !selectedSession || Boolean(selectedSession.sessionTypeMutable);
  const availableSessionTypeSet = useMemo(
    () => new Set(runtimeSessionTypeOptions.map((option) => option.value)),
    [runtimeSessionTypeOptions]
  );
  const sessionTypeUnavailable = useMemo(() => {
    if (selectedSession && !availableSessionTypeSet.has(normalizeSessionType(selectedSession.sessionType))) {
      return true;
    }
    return selectedSessionTypeOption?.ready === false;
  }, [availableSessionTypeSet, selectedSession, selectedSessionTypeOption?.ready]);
  const sessionTypeUnavailableMessage = useMemo(() => {
    if (selectedSession && !availableSessionTypeSet.has(normalizeSessionType(selectedSession.sessionType))) {
      return `${resolveSessionTypeLabel(selectedSessionType)} ${t('chatSessionTypeUnavailableSuffix')}`;
    }
    if (selectedSessionTypeOption?.ready === false) {
      return selectedSessionTypeOption.reasonMessage?.trim() || `${selectedSessionTypeOption.label} setup required`;
    }
    return null;
  }, [availableSessionTypeSet, selectedSession, selectedSessionType, selectedSessionTypeOption]);

  return {
    sessionTypeOptions,
    selectedSessionTypeOption,
    defaultSessionType,
    selectedSessionType,
    canEditSessionType,
    sessionTypeUnavailable,
    sessionTypeUnavailableMessage
  };
}
