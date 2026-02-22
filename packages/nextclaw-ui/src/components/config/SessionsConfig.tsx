import { useEffect, useMemo, useState } from 'react';
import type { SessionEntryView, SessionMessageView } from '@/api/types';
import { useDeleteSession, useSessionHistory, useSessions, useUpdateSession } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/i18n';
import { RefreshCw, Save, Search, Trash2 } from 'lucide-react';

const UNKNOWN_CHANNEL_KEY = '__unknown_channel__';

type SessionGroupMode = 'all' | 'by-channel';

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

type SessionRowProps = {
  session: SessionEntryView;
  channel: string;
  isSelected: boolean;
  labelValue: string;
  modelValue: string;
  onToggleHistory: () => void;
  onLabelChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  onDelete: () => void;
};

function SessionRow(props: SessionRowProps) {
  const { session } = props;
  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 text-xs text-gray-600">
        <div>
          <span className="font-semibold text-gray-800">{t('sessionsKeyLabel')}:</span> {session.key}
        </div>
        <div>
          <span className="font-semibold text-gray-800">{t('sessionsChannelLabel')}:</span> {displayChannelName(props.channel)}
        </div>
        <div>
          <span className="font-semibold text-gray-800">{t('sessionsMessagesLabel')}:</span> {session.messageCount}
        </div>
        <div>
          <span className="font-semibold text-gray-800">{t('sessionsUpdatedLabel')}:</span> {formatDate(session.updatedAt)}
        </div>
        <div>
          <span className="font-semibold text-gray-800">{t('sessionsLastRoleLabel')}:</span> {session.lastRole ?? '-'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input value={props.labelValue} onChange={(event) => props.onLabelChange(event.target.value)} placeholder={t('sessionsLabelPlaceholder')} />
        <Input
          value={props.modelValue}
          onChange={(event) => props.onModelChange(event.target.value)}
          placeholder={t('sessionsModelPlaceholder')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={props.isSelected ? 'default' : 'outline'} size="sm" onClick={props.onToggleHistory}>
          {props.isSelected ? t('sessionsHideHistory') : t('sessionsShowHistory')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onSave}>
          <Save className="h-4 w-4 mr-1" />
          {t('sessionsSaveMeta')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onClear}>
          {t('sessionsClearHistory')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onDelete}>
          <Trash2 className="h-4 w-4 mr-1" />
          {t('delete')}
        </Button>
      </div>
    </div>
  );
}

function SessionMessageItem({ message, index }: { message: SessionMessageView; index: number }) {
  return (
    <div key={`${message.timestamp}-${index}`} className="rounded-lg border border-gray-200 p-2">
      <div className="text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{message.role}</span> · {formatDate(message.timestamp)}
      </div>
      <div className="text-sm whitespace-pre-wrap break-words mt-1">{message.content}</div>
    </div>
  );
}

export function SessionsConfig() {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [activeMinutes, setActiveMinutes] = useState(0);
  const [groupMode, setGroupMode] = useState<SessionGroupMode>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<Record<string, string>>({});
  const [modelDraft, setModelDraft] = useState<Record<string, string>>({});

  const sessionsParams = useMemo(() => ({ q: query.trim() || undefined, limit, activeMinutes }), [query, limit, activeMinutes]);
  const sessionsQuery = useSessions(sessionsParams);
  const historyQuery = useSessionHistory(selectedKey, 200);
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();

  useEffect(() => {
    const sessions = sessionsQuery.data?.sessions ?? [];
    if (!sessions.length) {
      return;
    }
    setLabelDraft((prev) => {
      const next = { ...prev };
      for (const session of sessions) {
        if (!(session.key in next)) {
          next[session.key] = session.label ?? '';
        }
      }
      return next;
    });
    setModelDraft((prev) => {
      const next = { ...prev };
      for (const session of sessions) {
        if (!(session.key in next)) {
          next[session.key] = session.preferredModel ?? '';
        }
      }
      return next;
    });
  }, [sessionsQuery.data]);

  const sessions = sessionsQuery.data?.sessions ?? [];

  const groupedSessions = useMemo(() => {
    const buckets = new Map<string, SessionEntryView[]>();
    for (const session of sessions) {
      const channel = resolveChannelFromSessionKey(session.key);
      const list = buckets.get(channel);
      if (list) {
        list.push(session);
      } else {
        buckets.set(channel, [session]);
      }
    }
    return Array.from(buckets.entries())
      .sort((a, b) => {
        if (a[0] === UNKNOWN_CHANNEL_KEY) {
          return 1;
        }
        if (b[0] === UNKNOWN_CHANNEL_KEY) {
          return -1;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(([channel, rows]) => ({ channel, rows }));
  }, [sessions]);

  const saveSessionMeta = (key: string) => {
    updateSession.mutate({
      key,
      data: {
        label: (labelDraft[key] ?? '').trim() || null,
        preferredModel: (modelDraft[key] ?? '').trim() || null
      }
    });
  };

  const clearSessionHistory = (key: string) => {
    updateSession.mutate({ key, data: { clearHistory: true } });
    if (selectedKey === key) {
      setSelectedKey(null);
    }
  };

  const deleteSessionByKey = (key: string) => {
    const confirmed = window.confirm(`${t('sessionsDeleteConfirm')} ${key} ?`);
    if (!confirmed) {
      return;
    }
    deleteSession.mutate(
      { key },
      {
        onSuccess: () => {
          if (selectedKey === key) {
            setSelectedKey(null);
          }
        }
      }
    );
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('sessionsPageTitle')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('sessionsPageDescription')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('sessionsFiltersTitle')}</CardTitle>
          <CardDescription>{t('sessionsFiltersDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('sessionsSearchPlaceholder')} className="pl-9" />
          </div>
          <Input
            type="number"
            min={0}
            value={activeMinutes}
            onChange={(event) => setActiveMinutes(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
            placeholder={t('sessionsActiveMinutesPlaceholder')}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={limit}
              onChange={(event) => setLimit(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
              placeholder={t('sessionsLimitPlaceholder')}
            />
            <Button type="button" variant="outline" onClick={() => sessionsQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">{t('sessionsGroupModeLabel')}</div>
            <select
              value={groupMode}
              onChange={(event) => setGroupMode(event.target.value as SessionGroupMode)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            >
              <option value="all">{t('sessionsGroupModeAll')}</option>
              <option value="by-channel">{t('sessionsGroupModeByChannel')}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sessionsListTitle')}</CardTitle>
          <CardDescription>
            {t('sessionsTotalLabel')} {sessionsQuery.data?.total ?? 0} · {t('sessionsCurrentLabel')} {sessions.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsQuery.isLoading ? <div className="text-sm text-gray-500">{t('sessionsLoading')}</div> : null}
          {sessionsQuery.error ? <div className="text-sm text-red-600">{(sessionsQuery.error as Error).message}</div> : null}
          {!sessionsQuery.isLoading && !sessions.length ? <div className="text-sm text-gray-500">{t('sessionsEmpty')}</div> : null}

          {groupMode === 'all'
            ? sessions.map((session) => (
                <SessionRow
                  key={session.key}
                  session={session}
                  channel={resolveChannelFromSessionKey(session.key)}
                  isSelected={selectedKey === session.key}
                  labelValue={labelDraft[session.key] ?? ''}
                  modelValue={modelDraft[session.key] ?? ''}
                  onToggleHistory={() => setSelectedKey((prev) => (prev === session.key ? null : session.key))}
                  onLabelChange={(value) => setLabelDraft((prev) => ({ ...prev, [session.key]: value }))}
                  onModelChange={(value) => setModelDraft((prev) => ({ ...prev, [session.key]: value }))}
                  onSave={() => saveSessionMeta(session.key)}
                  onClear={() => clearSessionHistory(session.key)}
                  onDelete={() => deleteSessionByKey(session.key)}
                />
              ))
            : groupedSessions.map((group) => (
                <div key={group.channel} className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">
                    {t('sessionsChannelLabel')}: {displayChannelName(group.channel)} ({group.rows.length})
                  </div>
                  <div className="space-y-3">
                    {group.rows.map((session) => (
                      <SessionRow
                        key={session.key}
                        session={session}
                        channel={group.channel}
                        isSelected={selectedKey === session.key}
                        labelValue={labelDraft[session.key] ?? ''}
                        modelValue={modelDraft[session.key] ?? ''}
                        onToggleHistory={() => setSelectedKey((prev) => (prev === session.key ? null : session.key))}
                        onLabelChange={(value) => setLabelDraft((prev) => ({ ...prev, [session.key]: value }))}
                        onModelChange={(value) => setModelDraft((prev) => ({ ...prev, [session.key]: value }))}
                        onSave={() => saveSessionMeta(session.key)}
                        onClear={() => clearSessionHistory(session.key)}
                        onDelete={() => deleteSessionByKey(session.key)}
                      />
                    ))}
                  </div>
                </div>
              ))}
        </CardContent>
      </Card>

      {selectedKey ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('sessionsHistoryTitle')}: {selectedKey}
            </CardTitle>
            <CardDescription>{t('sessionsHistoryDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {historyQuery.isLoading ? <div className="text-sm text-gray-500">{t('sessionsHistoryLoading')}</div> : null}
            {historyQuery.error ? <div className="text-sm text-red-600">{(historyQuery.error as Error).message}</div> : null}
            {historyQuery.data ? (
              <div className="text-xs text-gray-500">
                {t('sessionsTotalLabel')}: {historyQuery.data.totalMessages} · metadata: {JSON.stringify(historyQuery.data.metadata ?? {})}
              </div>
            ) : null}
            <div className="max-h-[480px] overflow-auto space-y-2">
              {(historyQuery.data?.messages ?? []).map((message, index) => (
                <SessionMessageItem key={`${message.timestamp}-${index}`} message={message} index={index} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(updateSession.isPending || deleteSession.isPending) && <div className="text-xs text-gray-500">{t('sessionsApplyingChanges')}</div>}
    </div>
  );
}
