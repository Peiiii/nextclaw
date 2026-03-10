import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ChatRunView } from '@/api/types';
import type { ChatModelOption } from '@/components/chat/chat-input.types';
import { useChatRuns } from '@/hooks/useConfig';
import { buildActiveRunBySessionKey, buildSessionRunStatusByKey } from '@/lib/session-run-status';

export type ChatMainPanelView = 'chat' | 'cron' | 'skills';

export function useSyncSelectedModel(params: {
  modelOptions: ChatModelOption[];
  selectedSessionPreferredModel?: string;
  defaultModel?: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
}) {
  const { modelOptions, selectedSessionPreferredModel, defaultModel, setSelectedModel } = params;
  useEffect(() => {
    if (modelOptions.length === 0) {
      setSelectedModel('');
      return;
    }
    setSelectedModel((prev) => {
      if (modelOptions.some((option) => option.value === prev)) {
        return prev;
      }
      const sessionPreferred = selectedSessionPreferredModel?.trim();
      if (sessionPreferred && modelOptions.some((option) => option.value === sessionPreferred)) {
        return sessionPreferred;
      }
      const fallback = defaultModel?.trim();
      if (fallback && modelOptions.some((option) => option.value === fallback)) {
        return fallback;
      }
      return modelOptions[0]?.value ?? '';
    });
  }, [defaultModel, modelOptions, selectedSessionPreferredModel, setSelectedModel]);
}

export function useSessionRunStatus(params: {
  view: ChatMainPanelView;
  selectedSessionKey: string | null;
  activeBackendRunId: string | null;
  isLocallyRunning: boolean;
  resumeRun: (run: ChatRunView) => Promise<void>;
}) {
  const { view, selectedSessionKey, activeBackendRunId, isLocallyRunning, resumeRun } = params;
  const [suppressedSessionState, setSuppressedSessionState] = useState<{
    sessionKey: string;
    runId?: string;
  } | null>(null);
  const wasLocallyRunningRef = useRef(false);
  const resumedRunBySessionRef = useRef(new Map<string, string>());
  const completedRunBySessionRef = useRef(new Map<string, string>());
  const locallySettledAtBySessionRef = useRef(new Map<string, number>());
  const latestBackendRunIdRef = useRef<string | null>(activeBackendRunId);
  const autoResumeEligibleSessionsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!selectedSessionKey) {
      return;
    }
    autoResumeEligibleSessionsRef.current.add(selectedSessionKey);
  }, [selectedSessionKey]);

  useEffect(() => {
    if (!selectedSessionKey) {
      return;
    }
    if (isLocallyRunning) {
      autoResumeEligibleSessionsRef.current.delete(selectedSessionKey);
    }
  }, [isLocallyRunning, selectedSessionKey]);

  const sessionStatusRunsQuery = useChatRuns(
    view === 'chat'
      ? {
          states: ['queued', 'running'],
          limit: 200,
          syncActiveStates: true,
          isLocallyRunning
        }
      : undefined
  );
  const activeRunBySessionKey = useMemo(
    () => buildActiveRunBySessionKey(sessionStatusRunsQuery.data?.runs ?? []),
    [sessionStatusRunsQuery.data?.runs]
  );
  const sessionRunStatusByKey = useMemo(() => {
    const next = buildSessionRunStatusByKey(activeRunBySessionKey);
    if (suppressedSessionState) {
      const activeRun = activeRunBySessionKey.get(suppressedSessionState.sessionKey) ?? null;
      if (activeRun && (!suppressedSessionState.runId || activeRun.runId === suppressedSessionState.runId)) {
        next.delete(suppressedSessionState.sessionKey);
      }
    }
    return next;
  }, [activeRunBySessionKey, suppressedSessionState]);
  const activeRun = useMemo(() => {
    if (!selectedSessionKey) {
      return null;
    }
    const run = activeRunBySessionKey.get(selectedSessionKey) ?? null;
    const shouldSuppress = (() => {
      if (!run || !suppressedSessionState) {
        return false;
      }
      if (suppressedSessionState.sessionKey !== selectedSessionKey) {
        return false;
      }
      return !suppressedSessionState.runId || run.runId === suppressedSessionState.runId;
    })();
    if (shouldSuppress) {
      return null;
    }
    return run;
  }, [activeRunBySessionKey, selectedSessionKey, suppressedSessionState]);

  useEffect(() => {
    if (!activeBackendRunId) {
      return;
    }
    latestBackendRunIdRef.current = activeBackendRunId;
  }, [activeBackendRunId]);

  useEffect(() => {
    if (view !== 'chat' || !selectedSessionKey || !activeRun) {
      return;
    }
    if (!autoResumeEligibleSessionsRef.current.has(selectedSessionKey)) {
      return;
    }
    if (isLocallyRunning) {
      return;
    }
    if (activeBackendRunId === activeRun.runId) {
      return;
    }
    const resumedRunId = resumedRunBySessionRef.current.get(selectedSessionKey);
    if (resumedRunId === activeRun.runId) {
      return;
    }
    const completedRunId = completedRunBySessionRef.current.get(selectedSessionKey);
    if (completedRunId && completedRunId === activeRun.runId) {
      return;
    }
    const locallySettledAt = locallySettledAtBySessionRef.current.get(selectedSessionKey);
    if (typeof locallySettledAt === 'number') {
      const requestedAt = Date.parse(activeRun.requestedAt ?? '');
      if (Number.isFinite(requestedAt)) {
        if (requestedAt <= locallySettledAt + 2_000) {
          return;
        }
      } else if (Date.now() - locallySettledAt <= 8_000) {
        return;
      }
    }
    resumedRunBySessionRef.current.set(selectedSessionKey, activeRun.runId);
    autoResumeEligibleSessionsRef.current.delete(selectedSessionKey);
    void resumeRun(activeRun);
  }, [activeBackendRunId, activeRun, isLocallyRunning, resumeRun, selectedSessionKey, view]);

  useEffect(() => {
    if (!selectedSessionKey) {
      resumedRunBySessionRef.current.clear();
      completedRunBySessionRef.current.clear();
      locallySettledAtBySessionRef.current.clear();
      autoResumeEligibleSessionsRef.current.clear();
      return;
    }
    if (!activeRunBySessionKey.has(selectedSessionKey)) {
      resumedRunBySessionRef.current.delete(selectedSessionKey);
      completedRunBySessionRef.current.delete(selectedSessionKey);
      locallySettledAtBySessionRef.current.delete(selectedSessionKey);
    }
  }, [activeRunBySessionKey, selectedSessionKey]);

  useEffect(() => {
    const wasRunning = wasLocallyRunningRef.current;
    wasLocallyRunningRef.current = isLocallyRunning;
    if (isLocallyRunning) {
      return;
    }
    if (wasRunning && selectedSessionKey) {
      const completedRunId = latestBackendRunIdRef.current?.trim() || activeRunBySessionKey.get(selectedSessionKey)?.runId?.trim();
      if (completedRunId) {
        completedRunBySessionRef.current.set(selectedSessionKey, completedRunId);
      }
      locallySettledAtBySessionRef.current.set(selectedSessionKey, Date.now());
      setSuppressedSessionState({
        sessionKey: selectedSessionKey,
        ...(completedRunId ? { runId: completedRunId } : {})
      });
      void sessionStatusRunsQuery.refetch();
    }
  }, [activeRunBySessionKey, isLocallyRunning, selectedSessionKey, sessionStatusRunsQuery]);

  useEffect(() => {
    if (!suppressedSessionState) {
      return;
    }
    const activeRun = activeRunBySessionKey.get(suppressedSessionState.sessionKey) ?? null;
    if (!activeRun) {
      setSuppressedSessionState(null);
      return;
    }
    if (suppressedSessionState.runId && activeRun.runId !== suppressedSessionState.runId) {
      setSuppressedSessionState(null);
    }
  }, [activeRunBySessionKey, suppressedSessionState]);

  useEffect(() => {
    if (!isLocallyRunning) {
      return;
    }
    if (suppressedSessionState?.sessionKey === selectedSessionKey) {
      setSuppressedSessionState(null);
    }
  }, [isLocallyRunning, selectedSessionKey, suppressedSessionState]);

  return { sessionRunStatusByKey };
}
