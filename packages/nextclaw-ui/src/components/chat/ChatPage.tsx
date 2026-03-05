import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { SessionEntryView, SessionEventView } from '@/api/types';
import {
  useChatCapabilities,
  useConfig,
  useConfigMeta,
  useDeleteSession,
  useSessionHistory,
  useSessions,
  useChatRuns
} from '@/hooks/useConfig';
import { useMarketplaceInstalled } from '@/hooks/useMarketplace';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { ChatModelOption } from '@/components/chat/ChatInputBar';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatConversationPanel } from '@/components/chat/ChatConversationPanel';
import { CronConfig } from '@/components/config/CronConfig';
import { MarketplacePage } from '@/components/marketplace/MarketplacePage';
import { useChatStreamController } from '@/components/chat/useChatStreamController';
import { buildFallbackEventsFromMessages } from '@/lib/chat-message';
import { buildProviderModelCatalog, composeProviderModel } from '@/lib/provider-models';
import { buildActiveRunBySessionKey, buildSessionRunStatusByKey } from '@/lib/session-run-status';
import { t } from '@/lib/i18n';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const SESSION_ROUTE_PREFIX = 'sid_';

function resolveAgentIdFromSessionKey(sessionKey: string): string | null {
  const match = /^agent:([^:]+):/i.exec(sessionKey.trim());
  if (!match) {
    return null;
  }
  const value = match[1]?.trim();
  return value ? value : null;
}

function buildNewSessionKey(agentId: string): string {
  const slug = Math.random().toString(36).slice(2, 8);
  return `agent:${agentId}:ui:direct:web-${Date.now().toString(36)}${slug}`;
}

function encodeSessionRouteId(sessionKey: string): string {
  const bytes = new TextEncoder().encode(sessionKey);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${SESSION_ROUTE_PREFIX}${base64}`;
}

function decodeSessionRouteId(routeValue: string): string | null {
  if (!routeValue.startsWith(SESSION_ROUTE_PREFIX)) {
    return null;
  }
  const encoded = routeValue.slice(SESSION_ROUTE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
  const padding = encoded.length % 4 === 0 ? '' : '='.repeat(4 - (encoded.length % 4));
  try {
    const binary = atob(encoded + padding);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function parseSessionKeyFromRoute(routeValue?: string): string | null {
  if (!routeValue) {
    return null;
  }
  const decodedToken = decodeSessionRouteId(routeValue);
  if (decodedToken) {
    return decodedToken;
  }
  try {
    return decodeURIComponent(routeValue);
  } catch {
    return routeValue;
  }
}

function buildSessionPath(sessionKey: string): string {
  return `/chat/${encodeSessionRouteId(sessionKey)}`;
}

function sessionDisplayName(session: SessionEntryView): string {
  if (session.label && session.label.trim()) {
    return session.label.trim();
  }
  const chunks = session.key.split(':');
  return chunks[chunks.length - 1] || session.key;
}

type MainPanelView = 'chat' | 'cron' | 'skills';

type ChatPageProps = {
  view: MainPanelView;
};

type UseSessionSyncParams = {
  view: MainPanelView;
  routeSessionKey: string | null;
  selectedSessionKey: string | null;
  selectedAgentId: string;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setSelectedAgentId: Dispatch<SetStateAction<string>>;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  isUserScrollingRef: MutableRefObject<boolean>;
  resetStreamState: () => void;
};

function useChatSessionSync(params: UseSessionSyncParams): void {
  const {
    view,
    routeSessionKey,
    selectedSessionKey,
    selectedAgentId,
    setSelectedSessionKey,
    setSelectedAgentId,
    selectedSessionKeyRef,
    isUserScrollingRef,
    resetStreamState
  } = params;

  useEffect(() => {
    if (view !== 'chat') {
      return;
    }
    if (routeSessionKey) {
      if (selectedSessionKey !== routeSessionKey) {
        setSelectedSessionKey(routeSessionKey);
      }
      return;
    }
    if (selectedSessionKey !== null) {
      setSelectedSessionKey(null);
      resetStreamState();
    }
  }, [resetStreamState, routeSessionKey, selectedSessionKey, setSelectedSessionKey, view]);

  useEffect(() => {
    const inferred = selectedSessionKey ? resolveAgentIdFromSessionKey(selectedSessionKey) : null;
    if (!inferred) {
      return;
    }
    if (selectedAgentId !== inferred) {
      setSelectedAgentId(inferred);
    }
  }, [selectedAgentId, selectedSessionKey, setSelectedAgentId]);

  useEffect(() => {
    selectedSessionKeyRef.current = selectedSessionKey;
    isUserScrollingRef.current = false;
  }, [isUserScrollingRef, selectedSessionKey, selectedSessionKeyRef]);
}

type UseThreadScrollParams = {
  threadRef: MutableRefObject<HTMLDivElement | null>;
  isUserScrollingRef: MutableRefObject<boolean>;
  mergedEvents: SessionEventView[];
  isSending: boolean;
};

function useChatThreadScroll(params: UseThreadScrollParams): { handleScroll: () => void } {
  const { threadRef, isUserScrollingRef, mergedEvents, isSending } = params;

  const isNearBottom = useCallback(() => {
    const element = threadRef.current;
    if (!element) {
      return true;
    }
    const threshold = 50;
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  }, [threadRef]);

  const handleScroll = useCallback(() => {
    if (isNearBottom()) {
      isUserScrollingRef.current = false;
    } else {
      isUserScrollingRef.current = true;
    }
  }, [isNearBottom, isUserScrollingRef]);

  useEffect(() => {
    const element = threadRef.current;
    if (!element || isUserScrollingRef.current) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [isSending, isUserScrollingRef, mergedEvents, threadRef]);

  return { handleScroll };
}

type ChatPageLayoutProps = {
  view: MainPanelView;
  sidebarProps: ComponentProps<typeof ChatSidebar>;
  conversationProps: ComponentProps<typeof ChatConversationPanel>;
  confirmDialog: JSX.Element;
};

function ChatPageLayout({ view, sidebarProps, conversationProps, confirmDialog }: ChatPageLayoutProps) {
  return (
    <div className="h-full flex">
      <ChatSidebar {...sidebarProps} />

      {view === 'chat' ? (
        <ChatConversationPanel {...conversationProps} />
      ) : (
        <section className="flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
          <div className="h-full overflow-auto custom-scrollbar">
            <div className="mx-auto w-full max-w-[min(1120px,100%)] px-6 py-5">
              {view === 'cron' ? <CronConfig /> : <MarketplacePage forcedType="skills" />}
            </div>
          </div>
        </section>
      )}

      {confirmDialog}
    </div>
  );
}

export function ChatPage({ view }: ChatPageProps) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('main');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const { confirm, ConfirmDialog } = useConfirmDialog();
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId: routeSessionIdParam } = useParams<{ sessionId?: string }>();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef(false);
  const selectedSessionKeyRef = useRef<string | null>(selectedSessionKey);
  const routeSessionKey = useMemo(
    () => parseSessionKeyFromRoute(routeSessionIdParam),
    [routeSessionIdParam]
  );

  const configQuery = useConfig();
  const configMetaQuery = useConfigMeta();
  const isProviderStateResolved =
    (configQuery.isFetched || configQuery.isSuccess) &&
    (configMetaQuery.isFetched || configMetaQuery.isSuccess);
  const sessionsQuery = useSessions({ q: query.trim() || undefined, limit: 120, activeMinutes: 0 });
  const installedSkillsQuery = useMarketplaceInstalled('skill');
  const chatCapabilitiesQuery = useChatCapabilities({
    sessionKey: selectedSessionKey,
    agentId: selectedAgentId
  });
  const historyQuery = useSessionHistory(selectedSessionKey, 300);
  const deleteSession = useDeleteSession();

  const modelOptions = useMemo<ChatModelOption[]>(() => {
    const providers = buildProviderModelCatalog({
      meta: configMetaQuery.data,
      config: configQuery.data,
      onlyConfigured: true
    });
    const seen = new Set<string>();
    const options: ChatModelOption[] = [];
    for (const provider of providers) {
      for (const localModel of provider.models) {
        const value = composeProviderModel(provider.prefix, localModel);
        if (!value || seen.has(value)) {
          continue;
        }
        seen.add(value);
        options.push({
          value,
          modelLabel: localModel,
          providerLabel: provider.displayName
        });
      }
    }
    return options.sort((left, right) => {
      const providerCompare = left.providerLabel.localeCompare(right.providerLabel);
      if (providerCompare !== 0) {
        return providerCompare;
      }
      return left.modelLabel.localeCompare(right.modelLabel);
    });
  }, [configMetaQuery.data, configQuery.data]);

  const sessions = useMemo(() => sessionsQuery.data?.sessions ?? [], [sessionsQuery.data?.sessions]);
  const skillRecords = useMemo(() => installedSkillsQuery.data?.records ?? [], [installedSkillsQuery.data?.records]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.key === selectedSessionKey) ?? null,
    [selectedSessionKey, sessions]
  );

  useEffect(() => {
    if (modelOptions.length === 0) {
      setSelectedModel('');
      return;
    }
    setSelectedModel((prev) => {
      if (modelOptions.some((option) => option.value === prev)) {
        return prev;
      }
      const sessionPreferred = selectedSession?.preferredModel?.trim();
      if (sessionPreferred && modelOptions.some((option) => option.value === sessionPreferred)) {
        return sessionPreferred;
      }
      const fallback = configQuery.data?.agents.defaults.model?.trim();
      if (fallback && modelOptions.some((option) => option.value === fallback)) {
        return fallback;
      }
      return modelOptions[0]?.value ?? '';
    });
  }, [configQuery.data?.agents.defaults.model, modelOptions, selectedSession?.preferredModel]);

  const historyData = historyQuery.data;
  const historyMessages = historyData?.messages ?? [];
  const historyEvents =
    historyData?.events && historyData.events.length > 0
      ? historyData.events
      : buildFallbackEventsFromMessages(historyMessages);
  const nextOptimisticUserSeq = useMemo(
    () => historyEvents.reduce((max, event) => (Number.isFinite(event.seq) ? Math.max(max, event.seq) : max), 0) + 1,
    [historyEvents]
  );

  const {
    optimisticUserEvent,
    streamingSessionEvents,
    streamingAssistantText,
    streamingAssistantTimestamp,
    isSending,
    isAwaitingAssistantOutput,
    queuedCount,
    canStopCurrentRun,
    stopDisabledReason,
    lastSendError,
    sendMessage,
    resumeRun,
    activeBackendRunId,
    stopCurrentRun,
    resetStreamState
  } = useChatStreamController({
    nextOptimisticUserSeq,
    selectedSessionKeyRef,
    setSelectedSessionKey,
    setDraft,
    refetchSessions: sessionsQuery.refetch,
    refetchHistory: historyQuery.refetch
  });

  const sessionStatusRunsQuery = useChatRuns(
    view === 'chat'
      ? {
          states: ['queued', 'running'],
          limit: 200
        }
      : undefined
  );
  const activeRunBySessionKey = useMemo(
    () => buildActiveRunBySessionKey(sessionStatusRunsQuery.data?.runs ?? []),
    [sessionStatusRunsQuery.data?.runs]
  );
  const sessionRunStatusByKey = useMemo(
    () => buildSessionRunStatusByKey(activeRunBySessionKey),
    [activeRunBySessionKey]
  );
  const activeRun = useMemo(() => {
    if (!selectedSessionKey) {
      return null;
    }
    return activeRunBySessionKey.get(selectedSessionKey) ?? null;
  }, [activeRunBySessionKey, selectedSessionKey]);

  useEffect(() => {
    if (view !== 'chat' || !selectedSessionKey || !activeRun) {
      return;
    }
    if (activeBackendRunId === activeRun.runId) {
      return;
    }
    void resumeRun(activeRun);
  }, [activeBackendRunId, activeRun, resumeRun, selectedSessionKey, view]);

  const mergedEvents = useMemo(() => {
    const bySeq = new Map<number, SessionEventView>();
    const append = (event: SessionEventView) => {
      if (!Number.isFinite(event.seq)) {
        return;
      }
      bySeq.set(event.seq, event);
    };

    historyEvents.forEach(append);
    if (optimisticUserEvent) {
      append(optimisticUserEvent);
    }
    streamingSessionEvents.forEach(append);

    const next = [...bySeq.values()].sort((left, right) => left.seq - right.seq);
    if (streamingAssistantText.trim()) {
      const maxSeq = next.reduce((max, event) => (event.seq > max ? event.seq : max), 0);
      next.push({
        seq: maxSeq + 1,
        type: 'stream.assistant_delta',
        timestamp: streamingAssistantTimestamp ?? new Date().toISOString(),
        message: {
          role: 'assistant',
          content: streamingAssistantText,
          timestamp: streamingAssistantTimestamp ?? new Date().toISOString()
        }
      });
    }
    return next;
  }, [historyEvents, optimisticUserEvent, streamingAssistantText, streamingAssistantTimestamp, streamingSessionEvents]);

  useChatSessionSync({
    view,
    routeSessionKey,
    selectedSessionKey,
    selectedAgentId,
    setSelectedSessionKey,
    setSelectedAgentId,
    selectedSessionKeyRef,
    isUserScrollingRef,
    resetStreamState
  });

  const { handleScroll } = useChatThreadScroll({
    threadRef,
    isUserScrollingRef,
    mergedEvents,
    isSending
  });

  const createNewSession = useCallback(() => {
    resetStreamState();
    setSelectedSessionKey(null);
    if (location.pathname !== '/chat') {
      navigate('/chat');
    }
  }, [location.pathname, navigate, resetStreamState]);

  const goToProviders = useCallback(() => {
    if (location.pathname !== '/providers') {
      navigate('/providers');
    }
  }, [location.pathname, navigate]);

  const handleDeleteSession = useCallback(async () => {
    if (!selectedSessionKey) {
      return;
    }
    const confirmed = await confirm({
      title: t('chatDeleteSessionConfirm'),
      variant: 'destructive',
      confirmLabel: t('delete')
    });
    if (!confirmed) {
      return;
    }
    deleteSession.mutate(
      { key: selectedSessionKey },
      {
        onSuccess: async () => {
          resetStreamState();
          setSelectedSessionKey(null);
          navigate('/chat', { replace: true });
          await sessionsQuery.refetch();
        }
      }
    );
  }, [confirm, deleteSession, navigate, resetStreamState, selectedSessionKey, sessionsQuery]);

  const handleSend = useCallback(async () => {
    const message = draft.trim();
    if (!message) {
      return;
    }
    const requestedSkills = selectedSkills;

    const sessionKey = selectedSessionKey ?? buildNewSessionKey(selectedAgentId);
    if (!selectedSessionKey) {
      navigate(buildSessionPath(sessionKey), { replace: true });
    }
    setDraft('');
    setSelectedSkills([]);
    await sendMessage({
      message,
      sessionKey,
      agentId: selectedAgentId,
      model: selectedModel || undefined,
      stopSupported: chatCapabilitiesQuery.data?.stopSupported ?? false,
      stopReason: chatCapabilitiesQuery.data?.stopReason,
      requestedSkills,
      restoreDraftOnError: true
    });
  }, [
    chatCapabilitiesQuery.data?.stopReason,
    chatCapabilitiesQuery.data?.stopSupported,
    draft,
    selectedAgentId,
    selectedModel,
    navigate,
    selectedSessionKey,
    selectedSkills,
    sendMessage
  ]);

  const currentSessionDisplayName = selectedSession ? sessionDisplayName(selectedSession) : undefined;
  const handleSelectSession = useCallback((nextSessionKey: string) => {
    const target = buildSessionPath(nextSessionKey);
    if (location.pathname !== target) {
      navigate(target);
    }
  }, [location.pathname, navigate]);

  const sidebarProps: ComponentProps<typeof ChatSidebar> = {
    sessions,
    sessionRunStatusByKey,
    selectedSessionKey,
    onSelectSession: handleSelectSession,
    onCreateSession: createNewSession,
    sessionTitle: sessionDisplayName,
    isLoading: sessionsQuery.isLoading,
    query,
    onQueryChange: setQuery
  };

  const conversationProps: ComponentProps<typeof ChatConversationPanel> = {
    isProviderStateResolved,
    modelOptions,
    selectedModel,
    onSelectedModelChange: setSelectedModel,
    onGoToProviders: goToProviders,
    skillRecords,
    isSkillsLoading: installedSkillsQuery.isLoading,
    selectedSkills,
    onSelectedSkillsChange: setSelectedSkills,
    selectedSessionKey,
    sessionDisplayName: currentSessionDisplayName,
    canDeleteSession: Boolean(selectedSession),
    isDeletePending: deleteSession.isPending,
    onDeleteSession: () => {
      void handleDeleteSession();
    },
    onCreateSession: createNewSession,
    threadRef,
    onThreadScroll: handleScroll,
    isHistoryLoading: historyQuery.isLoading,
    mergedEvents,
    isSending,
    isAwaitingAssistantOutput,
    streamingAssistantText,
    draft,
    onDraftChange: setDraft,
    onSend: handleSend,
    onStop: () => {
      void stopCurrentRun();
    },
    canStopGeneration: canStopCurrentRun,
    stopDisabledReason,
    sendError: lastSendError,
    queuedCount
  };

  return (
    <ChatPageLayout
      view={view}
      sidebarProps={sidebarProps}
      conversationProps={conversationProps}
      confirmDialog={<ConfirmDialog />}
    />
  );
}
