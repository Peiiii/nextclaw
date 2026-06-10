import { useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ChatSessionTypeOptionView, SessionEntryView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import {
  buildSessionTypeOptions,
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
  resolveSessionTypeLabel,
  type ChatSessionTypeOption,
} from '@/features/chat/features/session-type/utils/chat-session-type.utils';

export {
  buildSessionTypeOptions,
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
  resolveAgentRuntimeSessionType,
  resolveSessionTypeLabel,
  type ChatSessionTypeOption,
} from '@/features/chat/features/session-type/utils/chat-session-type.utils';

type UseChatSessionTypeStateParams = { selectedSession: SessionEntryView | null; pendingSessionType: string; setPendingSessionType: Dispatch<SetStateAction<string>>; sessionTypesData?: { defaultType?: string; options?: ChatSessionTypeOptionView[] } | null };

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
        modelSelectionMode: 'nextclaw',
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
  const normalizedPendingSessionType =
    typeof pendingSessionType === 'string' && pendingSessionType.trim().length > 0
      ? pendingSessionType
      : undefined;
  const selectedSessionType = useMemo(
    () => normalizeSessionType(selectedSession?.sessionType ?? normalizedPendingSessionType ?? defaultSessionType),
    [defaultSessionType, normalizedPendingSessionType, selectedSession?.sessionType]
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
