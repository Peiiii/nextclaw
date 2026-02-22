import { useEffect, useMemo, useState } from 'react';
import type { SessionEntryView, SessionMessageView } from '@/api/types';
import { useDeleteSession, useSessionHistory, useSessions, useUpdateSession } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { RefreshCw, Search, Clock, Inbox, Hash, Bot, User, MessageCircle } from 'lucide-react';

const UNKNOWN_CHANNEL_KEY = '__unknown_channel__';

function formatDate(value?: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function resolveChannelFromSessionKey(key: string): string {
  const separator = key.indexOf(':');
  if (separator <= 0) {
    return UNKNOWN_CHANNEL_KEY;
  }
  const channel = key.slice(0, separator).trim();
  return channel || UNKNOWN_CHANNEL_KEY;
}

function displayChannelName(channel: string): string {
  if (channel === UNKNOWN_CHANNEL_KEY) {
    return t('sessionsUnknownChannel');
  }
  return channel;
}

// ============================================================================
// COMPONENT: Left Sidebar Session Item
// ============================================================================

type SessionListItemProps = {
  session: SessionEntryView;
  channel: string;
  isSelected: boolean;
  onSelect: () => void;
};

function SessionListItem({ session, channel, isSelected, onSelect }: SessionListItemProps) {
  const channelDisplay = displayChannelName(channel);
  const displayName = session.label || session.key.split(':').pop() || session.key;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-xl border transition-all duration-200 focus:outline-none",
        isSelected
          ? "bg-primary-50 border-primary-200 shadow-sm"
          : "bg-white border-transparent hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm"
      )}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="font-medium text-gray-900 truncate pr-2 flex-1 text-sm">{displayName}</div>
        <div className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0 capitalize">
          {channelDisplay}
        </div>
      </div>

      <div className="flex items-center text-xs text-gray-500 justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span className="truncate max-w-[100px]">{formatDate(session.updatedAt).split(' ')[0]}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>{session.messageCount}</span>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// COMPONENT: Right Side Chat Bubble Message Item
// ============================================================================

function SessionMessageBubble({ message }: { message: SessionMessageView }) {
  const isUser = message.role.toLowerCase() === 'user';

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] rounded-2xl p-4 flex gap-3 text-sm",
        isUser
          ? "bg-primary text-white rounded-tr-sm shadow-sm"
          : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-card-sm"
      )}>
        <div className="shrink-0 pt-0.5">
          {isUser ? <User className="w-4 h-4 text-primary-100" /> : <Bot className="w-4 h-4 text-gray-400" />}
        </div>
        <div className="flex-1 space-y-1 overflow-x-hidden">
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <span className={cn("font-semibold text-xs", isUser ? "text-primary-50" : "text-gray-900 capitalize")}>
              {message.role}
            </span>
            <span className={cn("text-[10px]", isUser ? "text-primary-200" : "text-gray-400")}>
              {formatDate(message.timestamp)}
            </span>
          </div>
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export function SessionsConfig() {
  const [query, setQuery] = useState('');
  const [limit] = useState(100);
  const [activeMinutes] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  // Local state drafts for editing the currently selected session
  const [draftLabel, setDraftLabel] = useState('');
  const [draftModel, setDraftModel] = useState('');

  const sessionsParams = useMemo(() => ({ q: query.trim() || undefined, limit, activeMinutes }), [query, limit, activeMinutes]);
  const sessionsQuery = useSessions(sessionsParams);
  const historyQuery = useSessionHistory(selectedKey, 200);

  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();

  const sessions = useMemo(() => sessionsQuery.data?.sessions ?? [], [sessionsQuery.data?.sessions]);
  const selectedSession = useMemo(() => sessions.find(s => s.key === selectedKey), [sessions, selectedKey]);

  const channels = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      set.add(resolveChannelFromSessionKey(s.key));
    }
    return Array.from(set).sort((a, b) => {
      if (a === UNKNOWN_CHANNEL_KEY) return 1;
      if (b === UNKNOWN_CHANNEL_KEY) return -1;
      return a.localeCompare(b);
    });
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (selectedChannel === 'all') return sessions;
    return sessions.filter(s => resolveChannelFromSessionKey(s.key) === selectedChannel);
  }, [sessions, selectedChannel]);

  // Sync draft states when selecting a new session
  useEffect(() => {
    if (selectedSession) {
      setDraftLabel(selectedSession.label || '');
      setDraftModel(selectedSession.preferredModel || '');
    } else {
      setDraftLabel('');
      setDraftModel('');
    }
  }, [selectedSession]);

  const handleSaveMeta = () => {
    if (!selectedKey) return;
    updateSession.mutate({
      key: selectedKey,
      data: {
        label: draftLabel.trim() || null,
        preferredModel: draftModel.trim() || null
      }
    });
  };

  const handleClearHistory = () => {
    if (!selectedKey) return;
    if (window.confirm(t('sessionsClearHistory') + "?")) {
      updateSession.mutate({ key: selectedKey, data: { clearHistory: true } });
    }
  };

  const handleDeleteSession = () => {
    if (!selectedKey) return;
    if (window.confirm(`${t('sessionsDeleteConfirm')} ?`)) {
      deleteSession.mutate(
        { key: selectedKey },
        {
          onSuccess: () => setSelectedKey(null)
        }
      );
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] w-full max-w-[1400px] mx-auto animate-fade-in flex flex-col pt-6 pb-2">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('sessionsPageTitle')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('sessionsPageDescription')}</p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-3">
          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger className="w-[180px] h-9 rounded-full bg-gray-50/50 hover:bg-gray-100 border-gray-200 focus:ring-0 shadow-none font-medium text-gray-700">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-gray-100">
              <SelectItem value="all" className="rounded-lg">All Channels</SelectItem>
              {channels.map(c => (
                <SelectItem key={c} value={c} className="rounded-lg">{displayChannelName(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-64">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sessionsSearchPlaceholder')}
              className="pl-9 h-9 rounded-full bg-gray-50/50 border-gray-200 focus-visible:bg-white"
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full text-gray-500" onClick={() => sessionsQuery.refetch()}>
            <RefreshCw className={cn("h-4 w-4", sessionsQuery.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Mailbox Layout */}
      <div className="flex-1 flex gap-6 min-h-0 relative">

        {/* LEFT COLUMN: List */}
        <div className="w-[320px] flex flex-col shrink-0">
          <div className="flex items-center justify-between px-1 mb-3 text-xs font-medium text-gray-500">
            <span>{sessions.length} {t('sessionsListTitle')}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-1.5 -mx-1.5 pt-1.5 -mt-1.5 space-y-2 pb-10 
            [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-300">
            {sessionsQuery.isLoading ? (
              <div className="text-sm text-gray-400 p-4 text-center">{t('sessionsLoading')}</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-sm text-gray-400 p-4 text-center border-2 border-dashed border-gray-100 rounded-xl mt-4">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                {t('sessionsEmpty')}
              </div>
            ) : (
              filteredSessions.map(session => (
                <SessionListItem
                  key={session.key}
                  session={session}
                  channel={resolveChannelFromSessionKey(session.key)}
                  isSelected={selectedKey === session.key}
                  onSelect={() => setSelectedKey(session.key)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Detail View */}
        <div className="flex-1 min-w-0 bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col overflow-hidden shadow-sm relative">

          {(updateSession.isPending || deleteSession.isPending) && (
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 overflow-hidden z-10">
              <div className="h-full bg-primary animate-pulse w-1/3 rounded-r-full" />
            </div>
          )}

          {selectedKey && selectedSession ? (
            <>
              {/* Detail Header / Metdata Editor */}
              <div className="shrink-0 bg-white border-b border-gray-200 p-5 shadow-sm z-10 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary shrink-0">
                      <Hash className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900 leading-none">
                          {selectedSession.label || selectedSession.key.split(':').pop() || selectedSession.key}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wide">
                          {displayChannelName(resolveChannelFromSessionKey(selectedSession.key))}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono break-all line-clamp-1" title={selectedKey}>
                        {selectedKey}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleClearHistory} className="h-8 shadow-none hover:bg-gray-100/50 hover:text-gray-900 border-gray-200">
                      {t('sessionsClearHistory')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeleteSession} className="h-8 shadow-none hover:bg-red-50 hover:text-red-600 hover:border-red-200 border-gray-200">
                      {t('delete')}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                  <Input
                    placeholder={t('sessionsLabelPlaceholder')}
                    value={draftLabel}
                    onChange={e => setDraftLabel(e.target.value)}
                    className="h-8 text-sm bg-white"
                  />
                  <Input
                    placeholder={t('sessionsModelPlaceholder')}
                    value={draftModel}
                    onChange={e => setDraftModel(e.target.value)}
                    className="h-8 text-sm bg-white"
                  />
                  <Button size="sm" onClick={handleSaveMeta} className="h-8 px-4 shrink-0 shadow-none" disabled={updateSession.isPending}>
                    {t('sessionsSaveMeta')}
                  </Button>
                </div>
              </div>

              {/* Chat History Area */}
              <div className="flex-1 overflow-y-auto p-6 relative
                [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300/80 [&::-webkit-scrollbar-thumb]:rounded-full">

                {historyQuery.isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-3 animate-pulse">
                      <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                      <span className="text-sm font-medium text-gray-500">{t('sessionsHistoryLoading')}</span>
                    </div>
                  </div>
                )}

                {historyQuery.error && (
                  <div className="text-center p-6 bg-red-50 rounded-xl text-red-600 border border-red-100 text-sm">
                    {(historyQuery.error as Error).message}
                  </div>
                )}

                {!historyQuery.isLoading && historyQuery.data?.messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="text-sm">{t('sessionsEmpty')}</p>
                  </div>
                )}

                <div className="max-w-3xl mx-auto">
                  {(historyQuery.data?.messages ?? []).map((message, idx) => (
                    <SessionMessageBubble key={`${message.timestamp}-${idx}`} message={message} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 h-full bg-white">
              <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-6 border border-gray-100 shadow-sm rotate-3">
                <Inbox className="h-8 w-8 text-gray-300 -rotate-3" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No Session Selected</h3>
              <p className="text-sm text-center max-w-sm leading-relaxed">
                Select a session from the list on the left to view its chat history and configure its metadata.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
