import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionEntryView } from '@/api/types';
import { useConfig, useConfigMeta, useDeleteSession, useSessionHistory, useSessions } from '@/hooks/useConfig';
import { useMarketplaceInstalled } from '@/hooks/useMarketplace';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { ChatModelOption } from '@/components/chat/ChatInputBar';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatConversationPanel } from '@/components/chat/ChatConversationPanel';
import { useChatStreamController } from '@/components/chat/useChatStreamController';
import { buildFallbackEventsFromMessages } from '@/lib/chat-message';
import { buildProviderModelCatalog, composeProviderModel } from '@/lib/provider-models';
import { t } from '@/lib/i18n';

const CHAT_SESSION_STORAGE_KEY = 'nextclaw.ui.chat.activeSession';

function readStoredSessionKey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    return value && value.trim().length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStoredSessionKey(value: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (!value) {
      window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
}

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

function sessionDisplayName(session: SessionEntryView): string {
  if (session.label && session.label.trim()) {
    return session.label.trim();
  }
  const chunks = session.key.split(':');
  return chunks[chunks.length - 1] || session.key;
}

export function ChatPage() {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(() => readStoredSessionKey());
  const [selectedAgentId, setSelectedAgentId] = useState('main');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const { confirm, ConfirmDialog } = useConfirmDialog();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef(false);
  const selectedSessionKeyRef = useRef<string | null>(selectedSessionKey);

  const configQuery = useConfig();
  const configMetaQuery = useConfigMeta();
  const sessionsQuery = useSessions({ q: query.trim() || undefined, limit: 120, activeMinutes: 0 });
  const installedSkillsQuery = useMarketplaceInstalled('skill');
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
    sendMessage,
    resetStreamState
  } = useChatStreamController({
    nextOptimisticUserSeq,
    selectedSessionKeyRef,
    setSelectedSessionKey,
    setDraft,
    refetchSessions: sessionsQuery.refetch,
    refetchHistory: historyQuery.refetch
  });

  const mergedEvents = useMemo(() => {
    const next = [...historyEvents];
    if (optimisticUserEvent) {
      next.push(optimisticUserEvent);
    }
    next.push(...streamingSessionEvents);
    if (streamingAssistantText.trim()) {
      const maxSeq = next.reduce((max, event) => {
        const seq = Number.isFinite(event.seq) ? event.seq : 0;
        return seq > max ? seq : max;
      }, 0);
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

  useEffect(() => {
    if (!selectedSessionKey && sessions.length > 0) {
      setSelectedSessionKey(sessions[0].key);
    }
  }, [sessions, selectedSessionKey]);

  useEffect(() => {
    writeStoredSessionKey(selectedSessionKey);
  }, [selectedSessionKey]);

  useEffect(() => {
    const inferred = selectedSessionKey ? resolveAgentIdFromSessionKey(selectedSessionKey) : null;
    if (!inferred) {
      return;
    }
    if (selectedAgentId !== inferred) {
      setSelectedAgentId(inferred);
    }
  }, [selectedAgentId, selectedSessionKey]);

  useEffect(() => {
    selectedSessionKeyRef.current = selectedSessionKey;
    isUserScrollingRef.current = false;
  }, [selectedSessionKey]);

  const isNearBottom = useCallback(() => {
    const element = threadRef.current;
    if (!element) return true;
    const threshold = 50;
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  }, []);

  const handleScroll = useCallback(() => {
    if (isNearBottom()) {
      isUserScrollingRef.current = false;
    } else {
      isUserScrollingRef.current = true;
    }
  }, [isNearBottom]);

  useEffect(() => {
    const element = threadRef.current;
    if (!element || isUserScrollingRef.current) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [mergedEvents, isSending]);

  const createNewSession = useCallback(() => {
    resetStreamState();
    const next = buildNewSessionKey(selectedAgentId);
    setSelectedSessionKey(next);
  }, [resetStreamState, selectedAgentId]);

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
          await sessionsQuery.refetch();
        }
      }
    );
  }, [confirm, deleteSession, resetStreamState, selectedSessionKey, sessionsQuery]);

  const handleSend = useCallback(async () => {
    const message = draft.trim();
    if (!message) {
      return;
    }
    const requestedSkills = selectedSkills;

    const sessionKey = selectedSessionKey ?? buildNewSessionKey(selectedAgentId);
    if (!selectedSessionKey) {
      setSelectedSessionKey(sessionKey);
    }
    setDraft('');
    setSelectedSkills([]);
    await sendMessage({
      message,
      sessionKey,
      agentId: selectedAgentId,
      model: selectedModel || undefined,
      requestedSkills,
      restoreDraftOnError: true
    });
  }, [draft, selectedAgentId, selectedModel, selectedSessionKey, selectedSkills, sendMessage]);

  const currentSessionDisplayName = selectedSession ? sessionDisplayName(selectedSession) : undefined;

  return (
    <div className="h-full flex">
      {/* Unified Chat Sidebar */}
      <ChatSidebar
        sessions={sessions}
        selectedSessionKey={selectedSessionKey}
        onSelectSession={setSelectedSessionKey}
        onCreateSession={createNewSession}
        sessionTitle={sessionDisplayName}
        isLoading={sessionsQuery.isLoading}
        query={query}
        onQueryChange={setQuery}
      />

      {/* Main conversation area */}
      <ChatConversationPanel
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSelectedModelChange={setSelectedModel}
        skillRecords={skillRecords}
        isSkillsLoading={installedSkillsQuery.isLoading}
        selectedSkills={selectedSkills}
        onSelectedSkillsChange={setSelectedSkills}
        selectedSessionKey={selectedSessionKey}
        sessionDisplayName={currentSessionDisplayName}
        canDeleteSession={Boolean(selectedSession)}
        isDeletePending={deleteSession.isPending}
        onDeleteSession={() => {
          void handleDeleteSession();
        }}
        onCreateSession={createNewSession}
        threadRef={threadRef}
        onThreadScroll={handleScroll}
        isHistoryLoading={historyQuery.isLoading}
        mergedEvents={mergedEvents}
        isSending={isSending}
        isAwaitingAssistantOutput={isAwaitingAssistantOutput}
        streamingAssistantText={streamingAssistantText}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        queuedCount={queuedCount}
      />

      <ConfirmDialog />
    </div>
  );
}
