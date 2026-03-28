import type { ChatToolPartViewModel } from '../../view-models/chat-ui.types';
import { AlertCircle, CheckCircle2, CircleSlash, Clock3, FileSearch, Globe, Loader2, Search, SendHorizontal, Terminal, Wrench } from 'lucide-react';
import { cn } from '../../internal/cn';

const TOOL_OUTPUT_PREVIEW_MAX = 220;
const TOOL_CALL_ID_PREVIEW_MAX = 18;

const STATUS_STYLES: Record<
  ChatToolPartViewModel['statusTone'],
  {
    text: string;
  }
> = {
  running: {
    text: 'text-amber-700/80',
  },
  success: {
    text: 'text-amber-700/80',
  },
  error: {
    text: 'text-amber-700/80',
  },
  cancelled: {
    text: 'text-amber-700/80',
  },
};

function renderToolIcon(toolName: string) {
  const lowered = toolName.toLowerCase();
  if (lowered.includes('exec') || lowered.includes('shell') || lowered.includes('command')) {
    return <Terminal className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('search')) {
    return <Search className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('fetch') || lowered.includes('http') || lowered.includes('web')) {
    return <Globe className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('read') || lowered.includes('file')) {
    return <FileSearch className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('message') || lowered.includes('send')) {
    return <SendHorizontal className="h-3.5 w-3.5" />;
  }
  if (lowered.includes('cron') || lowered.includes('schedule')) {
    return <Clock3 className="h-3.5 w-3.5" />;
  }
  return <Wrench className="h-3.5 w-3.5" />;
}

function truncateMiddle(value: string, maxLength = TOOL_CALL_ID_PREVIEW_MAX) {
  if (value.length <= maxLength) {
    return value;
  }
  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

function renderStatusMeta(card: ChatToolPartViewModel) {
  const style = STATUS_STYLES[card.statusTone];
  if (card.statusTone === 'running') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium leading-none', style.text)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {card.statusLabel}
      </span>
    );
  }
  const icon =
    card.statusTone === 'success' ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : card.statusTone === 'error' ? (
      <AlertCircle className="h-3.5 w-3.5" />
    ) : (
      <CircleSlash className="h-3.5 w-3.5" />
    );
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium leading-none', style.text)}>
      {icon}
      {card.statusTone === 'success' ? null : card.statusLabel}
    </span>
  );
}

export function ChatToolCard({ card }: { card: ChatToolPartViewModel }) {
  const output = card.output?.trim() ?? '';
  const showDetails = output.length > TOOL_OUTPUT_PREVIEW_MAX || output.includes('\n');
  const preview = showDetails ? `${output.slice(0, TOOL_OUTPUT_PREVIEW_MAX)}...` : output;
  const showOutputSection = card.kind === 'result' || card.hasResult;
  const statusStyle = STATUS_STYLES[card.statusTone];

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-800">
        {renderToolIcon(card.toolName)}
        <span>{card.titleLabel}</span>
        <span className="font-mono text-[11px] text-amber-900/80">{card.toolName}</span>
        {renderStatusMeta(card)}
      </div>

      {card.summary ? (
        <div className="mt-1">
          <div className="text-[10px] text-amber-700/75">{card.inputLabel}</div>
          <div className="break-words font-mono text-[11px] text-amber-800/90">{card.summary}</div>
        </div>
      ) : null}

      {card.callId ? (
        <div className={cn('mt-1 text-[10px]', statusStyle.text)}>
          <span>{card.callIdLabel}</span>
          <span>: </span>
          <span className="font-mono">{truncateMiddle(card.callId)}</span>
        </div>
      ) : null}

      {showOutputSection ? (
        <div className="mt-2">
          {!output ? (
            <div className="text-[11px] text-amber-700/80">{card.emptyLabel}</div>
          ) : showDetails ? (
            <details className="group">
              <summary className="cursor-pointer text-[11px] text-amber-700">{card.outputLabel}</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-amber-200 bg-amber-100/40 p-2 text-[11px] text-amber-900">
                {output}
              </pre>
            </details>
          ) : (
            <pre className="rounded-lg border border-amber-200 bg-amber-100/40 p-2 text-[11px] whitespace-pre-wrap break-words text-amber-900">
              {preview}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
