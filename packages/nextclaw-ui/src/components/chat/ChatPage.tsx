import { useEffect, useMemo, useRef, useState } from 'react';
import type { SessionEntryView, SessionMessageView } from '@/api/types';
import { useConfig, useDeleteSession, useSendChatTurn, useSessionHistory, useSessions } from '@/hooks/useConfig';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { ChatThread } from '@/components/chat/ChatThread';
import { cn } from '@/lib/utils';
import { formatDateTime, t } from '@/lib/i18n';
import { MessageSquareText, Plus, RefreshCw, Search, Send, Trash2 } from 'lucide-react';

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
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<SessionMessageView | null>(null);

  const { confirm, ConfirmDialog } = useConfirmDialog();
  const threadRef = useRef<HTMLDivElement | null>(null);

  const configQuery = useConfig();
  const sessionsQuery = useSessions({ q: query.trim() || undefined, limit: 120, activeMinutes: 0 });
  const historyQuery = useSessionHistory(selectedSessionKey, 300);
  const deleteSession = useDeleteSession();
  const sendChatTurn = useSendChatTurn();

  const agentOptions = useMemo(() => {
    const list = configQuery.data?.agents.list ?? [];
    const unique = new Set<string>(['main']);
    for (const item of list) {
      if (typeof item.id === 'string' && item.id.trim().length > 0) {
        unique.add(item.id.trim().toLowerCase());
      }
    }
    return Array.from(unique);
  }, [configQuery.data?.agents.list]);

  const sessions = useMemo(() => sessionsQuery.data?.sessions ?? [], [sessionsQuery.data?.sessions]);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.key === selectedSessionKey) ?? null,
    [selectedSessionKey, sessions]
  );

  const historyMessages = useMemo(() => historyQuery.data?.messages ?? [], [historyQuery.data?.messages]);
  const mergedMessages = useMemo(() => {
    if (!optimisticUserMessage) {
      return historyMessages;
    }
    return [...historyMessages, optimisticUserMessage];
  }, [historyMessages, optimisticUserMessage]);

  useEffect(() => {
    if (!selectedSessionKey && sessions.length > 0) {
      setSelectedSessionKey(sessions[0].key);
    }
  }, [selectedSessionKey, sessions]);

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
    const element = threadRef.current;
    if (!element) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [mergedMessages.length, sendChatTurn.isPending, selectedSessionKey]);

  const createNewSession = () => {
    const next = buildNewSessionKey(selectedAgentId);
    setSelectedSessionKey(next);
    setOptimisticUserMessage(null);
  };

  const handleDeleteSession = async () => {
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
          setSelectedSessionKey(null);
          setOptimisticUserMessage(null);
          await sessionsQuery.refetch();
        }
      }
    );
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sendChatTurn.isPending) {
      return;
    }

    const hadActiveSession = Boolean(selectedSessionKey);
    const sessionKey = selectedSessionKey ?? buildNewSessionKey(selectedAgentId);
    if (!selectedSessionKey) {
      setSelectedSessionKey(sessionKey);
    }
    setDraft('');
    setOptimisticUserMessage({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    try {
      const result = await sendChatTurn.mutateAsync({
        data: {
          message,
          sessionKey,
          agentId: selectedAgentId,
          channel: 'ui',
          chatId: 'web-ui'
        }
      });
      setOptimisticUserMessage(null);
      if (result.sessionKey !== sessionKey) {
        setSelectedSessionKey(result.sessionKey);
      }
      await sessionsQuery.refetch();
      if (hadActiveSession) {
        await historyQuery.refetch();
      }
    } catch {
      setOptimisticUserMessage(null);
      setDraft(message);
    }
  };

  return (
    <PageLayout fullHeight>
      <PageHeader
        title={t('chatPageTitle')}
        description={t('chatPageDescription')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => historyQuery.refetch()} className="rounded-lg">
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', historyQuery.isFetching && 'animate-spin')} />
              {t('chatRefresh')}
            </Button>
            <Button variant="primary" size="sm" onClick={createNewSession} className="rounded-lg">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('chatNewSession')}
            </Button>
          </div>
        }
      />

      <div className="flex-1 min-h-0 flex gap-4 max-lg:flex-col">
        <aside className="w-[320px] max-lg:w-full shrink-0 rounded-2xl border border-gray-200 bg-white shadow-card flex flex-col min-h-0">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('chatSearchSessionPlaceholder')}
                className="pl-8 h-9 rounded-lg text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => sessionsQuery.refetch()}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', sessionsQuery.isFetching && 'animate-spin')} />
                {t('chatRefresh')}
              </Button>
              <Button variant="subtle" size="sm" className="rounded-lg" onClick={createNewSession}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t('chatNewSession')}
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2">
            {sessionsQuery.isLoading ? (
              <div className="text-sm text-gray-500 p-4">{t('sessionsLoading')}</div>
            ) : sessions.length === 0 ? (
              <div className="p-5 m-2 rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-500">
                <MessageSquareText className="h-7 w-7 mx-auto mb-2 text-gray-300" />
                {t('sessionsEmpty')}
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => {
                  const active = selectedSessionKey === session.key;
                  return (
                    <button
                      key={session.key}
                      onClick={() => setSelectedSessionKey(session.key)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-2.5 text-left transition-all',
                        active
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      <div className="text-sm font-semibold text-gray-900 truncate">{sessionDisplayName(session)}</div>
                      <div className="mt-1 text-[11px] text-gray-500 truncate">{session.key}</div>
                      <div className="mt-1 text-[11px] text-gray-400">
                        {session.messageCount} · {formatDateTime(session.updatedAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 min-h-0 rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50/60 to-white shadow-card flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] max-w-[320px]">
              <div className="text-[11px] text-gray-500 mb-1">{t('chatAgentLabel')}</div>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder={t('chatSelectAgent')} />
                </SelectTrigger>
                <SelectContent>
                  {agentOptions.map((agent) => (
                    <SelectItem key={agent} value={agent}>
                      {agent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[260px]">
              <div className="text-[11px] text-gray-500 mb-1">{t('chatSessionLabel')}</div>
              <div className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-600 flex items-center truncate">
                {selectedSessionKey ?? t('chatNoSession')}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="rounded-lg self-end"
              onClick={handleDeleteSession}
              disabled={!selectedSession || deleteSession.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {t('chatDeleteSession')}
            </Button>
          </div>

          <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-5">
            {!selectedSessionKey ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MessageSquareText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <div className="text-sm font-medium">{t('chatNoSession')}</div>
                  <div className="text-xs mt-1">{t('chatNoSessionHint')}</div>
                </div>
              </div>
            ) : historyQuery.isLoading ? (
              <div className="text-sm text-gray-500">{t('chatHistoryLoading')}</div>
            ) : (
              <>
                {mergedMessages.length === 0 ? (
                  <div className="text-sm text-gray-500">{t('chatNoMessages')}</div>
                ) : (
                  <ChatThread messages={mergedMessages} isSending={sendChatTurn.isPending} />
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white p-4">
            <div className="rounded-xl border border-gray-200 bg-white p-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={t('chatInputPlaceholder')}
                className="w-full min-h-[68px] max-h-[220px] resize-y bg-transparent outline-none text-sm px-2 py-1.5 text-gray-800 placeholder:text-gray-400"
                disabled={sendChatTurn.isPending}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="text-[11px] text-gray-400">{t('chatInputHint')}</div>
                <Button
                  size="sm"
                  className="rounded-lg"
                  onClick={() => void handleSend()}
                  disabled={sendChatTurn.isPending || draft.trim().length === 0}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {sendChatTurn.isPending ? t('chatSending') : t('chatSend')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <ConfirmDialog />
    </PageLayout>
  );
}
