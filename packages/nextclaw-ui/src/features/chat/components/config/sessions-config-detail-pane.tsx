import { useState } from 'react';
import type { NcpMessageView, NcpSessionSummaryView, SessionEntryView } from '@/api/types';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { useDeleteNcpSession, useNcpSessionMessages, useUpdateNcpSession } from '@/shared/hooks/use-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SessionRunBadge } from '@/features/chat/components/session/session-run-badge';
import { cn } from '@/lib/utils';
import { formatDateTime, t } from '@/lib/i18n';
import { Bot, Hash, Inbox, MessageCircle, RefreshCw, Settings as SettingsIcon, User } from 'lucide-react';
function normalizeNcpRole(role: NcpMessageView['role']): 'user' | 'assistant' | 'system' | 'tool' {
  if (role === 'service') {
    return 'system';
  }
  if (role === 'tool') {
    return 'tool';
  }
  return role;
}
function extractNcpMessageText(message: NcpMessageView): string {
  const parts: string[] = [];
  for (const part of message.parts) {
    if (part.type === 'text' || part.type === 'rich-text' || part.type === 'reasoning') {
      parts.push(part.text);
      continue;
    }
    if (part.type !== 'tool-invocation') {
      continue;
    }
    const prefix = part.toolName?.trim() ? `[${part.toolName.trim()}]` : '[tool]';
    if (part.state === 'result' && typeof part.result === 'string' && part.result.trim()) {
      parts.push(`${prefix} ${part.result.trim()}`);
      continue;
    }
    parts.push(prefix);
  }
  return parts.join('\n').trim();
}
function SessionMessageBubble({ message }: { message: NcpMessageView }) {
  const role = normalizeNcpRole(message.role);
  const isUser = role === 'user';
  const content = extractNcpMessageText(message);
  return (
    <div className={cn('flex w-full mb-6', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-[1.25rem] p-5 flex gap-3 text-sm',
          isUser ? 'bg-primary text-white rounded-tr-sm' : 'bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100/50'
        )}
      >
        <div className="shrink-0 pt-0.5">
          {isUser ? <User className="w-4 h-4 text-primary-100" /> : <Bot className="w-4 h-4 text-gray-400" />}
        </div>
        <div className="flex-1 space-y-1 overflow-x-hidden">
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <span className={cn('font-semibold text-xs capitalize', isUser ? 'text-primary-50' : 'text-gray-900')}>
              {role}
            </span>
            <span className={cn('text-[10px]', isUser ? 'text-primary-200' : 'text-gray-400')}>
              {formatDateTime(message.timestamp)}
            </span>
          </div>
          <div className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">{content || '-'}</div>
        </div>
      </div>
    </div>
  );
}
function SessionMetadataEditor(props: {
  session: SessionEntryView;
  isPending: boolean;
  onSave: (data: { label: string; preferredModel: string }) => void;
}) {
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [draftLabel, setDraftLabel] = useState(props.session.label || '');
  const [draftModel, setDraftModel] = useState(props.session.preferredModel || '');
  const handleSave = () => {
    props.onSave({ label: draftLabel, preferredModel: draftModel });
    setIsEditingMeta(false);
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsEditingMeta((value) => !value)}
        className={cn(
          'h-8.5 rounded-lg shadow-none border-gray-200 transition-all text-xs font-semibold',
          isEditingMeta ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <SettingsIcon className="w-3.5 h-3.5 mr-1.5" />
        {t('sessionsMetadata')}
      </Button>
      {isEditingMeta ? (
        <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100 animate-slide-in">
          <Input
            placeholder={t('sessionsLabelPlaceholder')}
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            className="h-8 text-sm bg-white"
          />
          <Input
            placeholder={t('sessionsModelPlaceholder')}
            value={draftModel}
            onChange={(event) => setDraftModel(event.target.value)}
            className="h-8 text-sm bg-white"
          />
          <Button size="sm" onClick={handleSave} className="h-8 px-4 shrink-0 shadow-none" disabled={props.isPending}>
            {t('sessionsSaveMeta')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
function SessionEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 h-full bg-white">
      <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-6 border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.02)] rotate-3">
        <Inbox className="h-8 w-8 text-gray-300 -rotate-3" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{t('sessionsNoSelectionTitle')}</h3>
      <p className="text-sm text-center max-w-sm leading-relaxed">{t('sessionsNoSelectionDescription')}</p>
    </div>
  );
}
export function SessionsConfigDetailPane(props: {
  sessionKey: string | null;
  session: SessionEntryView | null;
  summary: NcpSessionSummaryView | null;
  channelLabel: string | null;
  onClearSelection: () => void;
}) {
  const historyQuery = useNcpSessionMessages(props.sessionKey, 300);
  const updateSession = useUpdateNcpSession();
  const deleteSession = useDeleteNcpSession();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const handleSaveMeta = (data: { label: string; preferredModel: string }) => {
    if (!props.sessionKey) {
      return;
    }
    updateSession.mutate({
      sessionId: props.sessionKey,
      data: {
        label: data.label.trim() || null,
        preferredModel: data.preferredModel.trim() || null
      }
    });
  };
  const handleDeleteSession = async () => {
    if (!props.sessionKey) {
      return;
    }
    const confirmed = await confirm({
      title: t('sessionsDeleteConfirm') + '?',
      variant: 'destructive',
      confirmLabel: t('sessionsDeleteConfirm')
    });
    if (!confirmed) {
      return;
    }
    deleteSession.mutate({ sessionId: props.sessionKey }, { onSuccess: () => props.onClearSelection() });
  };
  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative bg-white rounded-2xl shadow-sm border border-gray-200">
      {(updateSession.isPending || deleteSession.isPending) ? (
        <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 overflow-hidden z-20">
          <div className="h-full bg-primary animate-pulse w-1/3 rounded-r-full" />
        </div>
      ) : null}
      {props.sessionKey && props.session && props.summary && props.channelLabel ? (
        <>
          <div className="shrink-0 border-b border-gray-100 bg-white px-8 py-5 z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-[14px] bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                  <Hash className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight">{props.session.label?.trim() || props.session.key.split(':').pop() || props.session.key}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-widest">
                      {props.channelLabel}
                    </span>
                    {props.summary.status === 'running' ? <SessionRunBadge status="running" className="h-4 w-4" /> : null}
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all line-clamp-1 opacity-70" title={props.sessionKey}>
                    {props.sessionKey}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SessionMetadataEditor
                  key={props.session.key}
                  session={props.session}
                  isPending={updateSession.isPending}
                  onSave={handleSaveMeta}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSession}
                  className="h-8.5 rounded-lg shadow-none hover:bg-red-50 hover:text-red-600 hover:border-red-200 border-gray-200 text-xs font-semibold text-red-500"
                >
                  {t('delete')}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300/80 [&::-webkit-scrollbar-thumb]:rounded-full">
            {historyQuery.isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm z-10">
                <div className="flex flex-col items-center gap-3 animate-pulse">
                  <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                  <span className="text-sm font-medium text-gray-500">{t('sessionsHistoryLoading')}</span>
                </div>
              </div>
            ) : null}
            {historyQuery.error ? (
              <div className="text-center p-6 bg-red-50 rounded-xl text-red-600 border border-red-100 text-sm">
                {(historyQuery.error as Error).message}
              </div>
            ) : null}
            {!historyQuery.isLoading && historyQuery.data?.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-sm">{t('sessionsEmpty')}</p>
              </div>
            ) : null}
            <div className="max-w-3xl mx-auto">
              {(historyQuery.data?.messages ?? []).map((message) => (
                <SessionMessageBubble key={message.id} message={message} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <SessionEmptyState />
      )}
      <ConfirmDialog />
    </div>
  );
}
