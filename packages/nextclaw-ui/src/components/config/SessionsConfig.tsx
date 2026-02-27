import { useEffect, useMemo, useState } from 'react';
import type { SessionEntryView, SessionMessageView } from '@/api/types';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useDeleteSession, useSessionHistory, useSessions, useUpdateSession } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDateShort, formatDateTime, t } from '@/lib/i18n';
import { extractMessageText } from '@/lib/chat-message';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { RefreshCw, Search, Clock, Inbox, Hash, Bot, User, MessageCircle, Settings as SettingsIcon } from 'lucide-react';

const UNKNOWN_CHANNEL_KEY = '__unknown_channel__';

function formatDate(value?: string): string {
  return formatDateTime(value);
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
        "w-full text-left p-3.5 rounded-xl transition-all duration-200 outline-none focus:outline-none focus:ring-0 group",
        isSelected
          ? "bg-brand-50 border border-brand-100/50"
          : "bg-transparent border border-transparent hover:bg-gray-50/80"
      )}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className={cn("font-semibold truncate pr-2 flex-1 text-sm", isSelected ? "text-brand-800" : "text-gray-900")}>
          {displayName}
        </div>
        <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize", isSelected ? "bg-white text-brand-600 shadow-[0_1px_2px_rgba(0,0,0,0.02)]" : "bg-gray-100 text-gray-500")}>
          {channelDisplay}
        </div>
      </div>

      <div className={cn("flex items-center text-xs justify-between mt-2 font-medium", isSelected ? "text-brand-600/80" : "text-gray-400")}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 opacity-70" />
          <span className="truncate max-w-[100px]">{formatDateShort(session.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5 opacity-70" />
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
  const content = extractMessageText(message.content).trim();

  return (
    <div className={cn("flex w-full mb-6", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] rounded-[1.25rem] p-5 flex gap-3 text-sm",
        isUser
          ? "bg-primary text-white rounded-tr-sm"
          : "bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100/50"
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
          <div className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">
            {content || '-'}
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
  const [isEditingMeta, setIsEditingMeta] = useState(false);

  const sessionsParams = useMemo(() => ({ q: query.trim() || undefined, limit, activeMinutes }), [query, limit, activeMinutes]);
  const sessionsQuery = useSessions(sessionsParams);
  const historyQuery = useSessionHistory(selectedKey, 200);

  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();
  const { confirm, ConfirmDialog } = useConfirmDialog();

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
    setIsEditingMeta(false); // Reset editing state when switching sessions
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
    setIsEditingMeta(false); // Close editor on save
  };

  const handleClearHistory = async () => {
    if (!selectedKey) return;
    const confirmed = await confirm({
      title: t('sessionsClearHistory') + '?',
      variant: 'destructive',
      confirmLabel: t('sessionsClearHistory')
    });
    if (confirmed) {
      updateSession.mutate({ key: selectedKey, data: { clearHistory: true } });
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedKey) return;
    const confirmed = await confirm({
      title: t('sessionsDeleteConfirm') + '?',
      variant: 'destructive',
      confirmLabel: t('sessionsDeleteConfirm')
    });
    if (confirmed) {
      deleteSession.mutate(
        { key: selectedKey },
        {
          onSuccess: () => setSelectedKey(null)
        }
      );
    }
  };

  return (
    <PageLayout fullHeight>
      <PageHeader title={t('sessionsPageTitle')} description={t('sessionsPageDescription')} />

      {/* Main Mailbox Layout */}
      <div className="flex-1 flex gap-6 min-h-0 relative">

        {/* LEFT COLUMN: List Card */}
        <div className="w-[320px] flex flex-col shrink-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* List Card Header & Toolbar */}
          <div className="px-4 py-4 border-b border-gray-100 bg-white z-10 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {sessions.length} {t('sessionsListTitle')}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" onClick={() => sessionsQuery.refetch()}>
                <RefreshCw className={cn("h-3.5 w-3.5", sessionsQuery.isFetching && "animate-spin")} />
              </Button>
            </div>

            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-full h-8.5 rounded-lg bg-gray-50/50 hover:bg-gray-100 border-gray-200 focus:ring-0 shadow-none text-xs font-medium text-gray-700">
                <SelectValue placeholder={t('sessionsAllChannels')} />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-gray-100 max-w-[280px]">
                <SelectItem value="all" className="rounded-lg text-xs">{t('sessionsAllChannels')}</SelectItem>
                {channels.map(c => (
                  <SelectItem key={c} value={c} className="rounded-lg text-xs truncate pr-6">{displayChannelName(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-full">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('sessionsSearchPlaceholder')}
                className="pl-8 h-8.5 rounded-lg bg-gray-50/50 border-gray-200 focus-visible:bg-white text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1 pb-10 custom-scrollbar relative">
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

        {/* RIGHT COLUMN: Detail View Card */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative bg-white rounded-2xl shadow-sm border border-gray-200">

          {(updateSession.isPending || deleteSession.isPending) && (
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 overflow-hidden z-20">
              <div className="h-full bg-primary animate-pulse w-1/3 rounded-r-full" />
            </div>
          )}

          {selectedKey && selectedSession ? (
            <>
              {/* Detail Header / Metdata Editor */}
              <div className="shrink-0 border-b border-gray-100 bg-white px-8 py-5 z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-[14px] bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                      <Hash className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                          {selectedSession.label || selectedSession.key.split(':').pop() || selectedSession.key}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-widest">
                          {displayChannelName(resolveChannelFromSessionKey(selectedSession.key))}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono break-all line-clamp-1 opacity-70" title={selectedKey}>
                        {selectedKey}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingMeta(!isEditingMeta)} className={cn("h-8.5 rounded-lg shadow-none border-gray-200 transition-all text-xs font-semibold", isEditingMeta ? "bg-gray-100 text-gray-900" : "hover:bg-gray-50 hover:text-gray-900")}>
                      <SettingsIcon className="w-3.5 h-3.5 mr-1.5" />
                      {t('sessionsMetadata')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClearHistory} className="h-8.5 rounded-lg shadow-none hover:bg-gray-50 hover:text-gray-900 border-gray-200 text-xs font-semibold text-gray-500">
                      {t('sessionsClearHistory')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeleteSession} className="h-8.5 rounded-lg shadow-none hover:bg-red-50 hover:text-red-600 hover:border-red-200 border-gray-200 text-xs font-semibold text-red-500">
                      {t('delete')}
                    </Button>
                  </div>
                </div>

                {isEditingMeta && (
                  <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100 animate-slide-in">
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
                )}
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
              <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-6 border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.02)] rotate-3">
                <Inbox className="h-8 w-8 text-gray-300 -rotate-3" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('sessionsNoSelectionTitle')}</h3>
              <p className="text-sm text-center max-w-sm leading-relaxed">
                {t('sessionsNoSelectionDescription')}
              </p>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog />
    </PageLayout>
  );
}
