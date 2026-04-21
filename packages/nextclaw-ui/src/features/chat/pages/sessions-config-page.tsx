import { useMemo, useState } from 'react';
import type { NcpSessionSummaryView, SessionEntryView } from '@/api/types';
import { useNcpSessions } from '@/shared/hooks/use-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SessionRunBadge } from '@/features/chat/components/session/session-run-badge';
import { adaptNcpSessionSummaries, sessionDisplayName, sessionMatchesQuery } from '@/features/chat';
import { cn } from '@/lib/utils';
import { formatDateShort, t } from '@/lib/i18n';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { Clock, Inbox, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { SessionsConfigDetailPane } from '@/features/chat/components/config/sessions-config-detail-pane';
const UNKNOWN_CHANNEL_KEY = '__unknown_channel__';
function resolveChannelFromSessionKey(key: string): string {
  const separator = key.indexOf(':');
  if (separator <= 0) {
    return UNKNOWN_CHANNEL_KEY;
  }
  return key.slice(0, separator).trim() || UNKNOWN_CHANNEL_KEY;
}
function displayChannelName(channel: string): string {
  return channel === UNKNOWN_CHANNEL_KEY ? t('sessionsUnknownChannel') : channel;
}
function SessionListItem(props: {
  session: SessionEntryView;
  summary: NcpSessionSummaryView;
  channelLabel: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={props.onSelect}
      className={cn(
        'w-full text-left p-3.5 rounded-xl transition-all duration-200 outline-none focus:outline-none focus:ring-0 group',
        props.isSelected ? 'bg-brand-50 border border-brand-100/50' : 'bg-transparent border border-transparent hover:bg-gray-50/80'
      )}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div
          className={cn('font-semibold truncate pr-2 flex-1 text-sm', props.isSelected ? 'text-brand-800' : 'text-gray-900')}
        >
          {sessionDisplayName(props.session)}
        </div>
        <div
          className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize',
            props.isSelected ? 'bg-white text-brand-600 shadow-[0_1px_2px_rgba(0,0,0,0.02)]' : 'bg-gray-100 text-gray-500'
          )}
        >
          {props.channelLabel}
        </div>
      </div>
      <div
        className={cn('flex items-center text-xs justify-between mt-2 font-medium', props.isSelected ? 'text-brand-600/80' : 'text-gray-400')}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            {props.summary.status === 'running' ? <SessionRunBadge status="running" /> : null}
          </span>
          <Clock className="w-3.5 h-3.5 opacity-70" />
          <span className="truncate max-w-[100px]">{formatDateShort(props.summary.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5 opacity-70" />
          <span>{props.summary.messageCount}</span>
        </div>
      </div>
    </button>
  );
}
export function SessionsConfig() {
  const [query, setQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const sessionsQuery = useNcpSessions({ limit: 100 });
  const sessionSummaries = useMemo(() => sessionsQuery.data?.sessions ?? [], [sessionsQuery.data?.sessions]);
  const sessionEntries = useMemo(() => adaptNcpSessionSummaries(sessionSummaries), [sessionSummaries]);
  const sessionSummaryById = useMemo(() => new Map(sessionSummaries.map((session) => [session.sessionId, session])), [
    sessionSummaries
  ]);
  const filteredSessions = useMemo(
    () =>
      sessionEntries.filter((session) => {
        if (selectedChannel !== 'all' && resolveChannelFromSessionKey(session.key) !== selectedChannel) {
          return false;
        }
        return sessionMatchesQuery(session, query);
      }),
    [query, selectedChannel, sessionEntries]
  );
  const channels = useMemo(() => {
    const set = new Set<string>();
    for (const session of sessionEntries) {
      set.add(resolveChannelFromSessionKey(session.key));
    }
    return Array.from(set).sort((a, b) => {
      if (a === UNKNOWN_CHANNEL_KEY) {
        return 1;
      }
      if (b === UNKNOWN_CHANNEL_KEY) {
        return -1;
      }
      return a.localeCompare(b);
    });
  }, [sessionEntries]);
  const selectedSessionKey = selectedSessionId && sessionSummaryById.has(selectedSessionId) ? selectedSessionId : null;
  const selectedSession = useMemo(() => sessionEntries.find((session) => session.key === selectedSessionKey) ?? null, [
    selectedSessionKey,
    sessionEntries
  ]);
  const selectedSummary = selectedSessionKey ? sessionSummaryById.get(selectedSessionKey) ?? null : null;
  const selectedChannelLabel = selectedSession ? displayChannelName(resolveChannelFromSessionKey(selectedSession.key)) : null;
  return (
    <PageLayout fullHeight>
      <PageHeader title={t('sessionsPageTitle')} description={t('sessionsPageDescription')} />
      <div className="flex-1 flex gap-6 min-h-0 relative">
        <div className="w-[320px] flex flex-col shrink-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-100 bg-white z-10 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{sessionEntries.length} {t('sessionsListTitle')}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                onClick={() => sessionsQuery.refetch()}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', sessionsQuery.isFetching && 'animate-spin')} />
              </Button>
            </div>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-full h-8.5 rounded-lg bg-gray-50/50 hover:bg-gray-100 border-gray-200 focus:ring-0 shadow-none text-xs font-medium text-gray-700">
                <SelectValue placeholder={t('sessionsAllChannels')} />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-gray-100 max-w-[280px]">
                <SelectItem value="all" className="rounded-lg text-xs">{t('sessionsAllChannels')}</SelectItem>
                {channels.map((channel) => (
                  <SelectItem key={channel} value={channel} className="rounded-lg text-xs truncate pr-6">
                    {displayChannelName(channel)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
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
              filteredSessions.map((session) => {
                const summary = sessionSummaryById.get(session.key);
                if (!summary) {
                  return null;
                }
                return <SessionListItem key={session.key} session={session} summary={summary} channelLabel={displayChannelName(resolveChannelFromSessionKey(session.key))} isSelected={selectedSessionKey === session.key} onSelect={() => setSelectedSessionId(session.key)} />;
              })
            )}
          </div>
        </div>
        <SessionsConfigDetailPane
          sessionKey={selectedSessionKey}
          session={selectedSession}
          summary={selectedSummary}
          channelLabel={selectedChannelLabel}
          onClearSelection={() => setSelectedSessionId(null)}
        />
      </div>
    </PageLayout>
  );
}
