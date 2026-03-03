import { useMemo, type ReactNode } from 'react';
import type { SessionEventView, SessionMessageView } from '@/api/types';
import { cn } from '@/lib/utils';
import {
  buildChatTimeline,
  extractMessageText,
  extractToolCards,
  normalizeChatRole,
  type ChatRole,
  type ChatTimelineAssistantTurnItem,
  type ToolCard
} from '@/lib/chat-message';
import { formatDateTime, t } from '@/lib/i18n';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Bot, Clock3, FileSearch, Globe, Search, SendHorizontal, Terminal, User, Wrench } from 'lucide-react';

type ChatThreadProps = {
  events: SessionEventView[];
  isSending: boolean;
  className?: string;
};

const MARKDOWN_MAX_CHARS = 140_000;
const TOOL_OUTPUT_PREVIEW_MAX = 220;

type WorkflowToolCard = ToolCard & {
  _workflowStep?: number;
};

function trimMarkdown(value: string): string {
  if (value.length <= MARKDOWN_MAX_CHARS) {
    return value;
  }
  return `${value.slice(0, MARKDOWN_MAX_CHARS)}\n\n…`;
}

function roleTitle(role: ChatRole): string {
  if (role === 'user') return t('chatRoleUser');
  if (role === 'assistant') return t('chatRoleAssistant');
  if (role === 'tool') return t('chatRoleTool');
  if (role === 'system') return t('chatRoleSystem');
  return t('chatRoleMessage');
}

function renderToolIcon(name: string) {
  const lowered = name.toLowerCase();
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

function RoleAvatar({ role }: { role: ChatRole }) {
  if (role === 'user') {
    return (
      <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
        <User className="h-4 w-4" />
      </div>
    );
  }
  if (role === 'assistant') {
    return (
      <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm">
        <Bot className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shadow-sm">
      <Wrench className="h-4 w-4" />
    </div>
  );
}

function MarkdownBlock({ text, role }: { text: string; role: ChatRole }) {
  const isUser = role === 'user';
  return (
    <div className={cn('chat-markdown', isUser ? 'chat-markdown-user' : 'chat-markdown-assistant')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          )
        }}
      >
        {trimMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
}

function ToolCardView({ card }: { card: WorkflowToolCard }) {
  const title = card.kind === 'call' ? t('chatToolCall') : t('chatToolResult');
  const output = card.text?.trim() ?? '';
  const showDetails = output.length > TOOL_OUTPUT_PREVIEW_MAX || output.includes('\n');
  const preview = showDetails ? `${output.slice(0, TOOL_OUTPUT_PREVIEW_MAX)}…` : output;
  const showOutputSection = card.kind === 'result' || card.hasResult;

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800 font-semibold">
        {renderToolIcon(card.name)}
        <span>{title}</span>
        {typeof card._workflowStep === 'number' && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">#{card._workflowStep + 1}</span>
        )}
        <span className="font-mono text-[11px] text-amber-900/80">{card.name}</span>
      </div>
      {card.detail && (
        <div className="mt-1 text-[11px] text-amber-800/90 font-mono break-words">{card.detail}</div>
      )}
      {showOutputSection && (
        <div className="mt-2">
          {!output ? (
            <div className="text-[11px] text-amber-700/80">{t('chatToolNoOutput')}</div>
          ) : showDetails ? (
            <details className="group">
              <summary className="cursor-pointer text-[11px] text-amber-700">{t('chatToolOutput')}</summary>
              <pre className="mt-2 rounded-lg border border-amber-200 bg-amber-100/40 p-2 text-[11px] whitespace-pre-wrap break-words text-amber-900">
                {output}
              </pre>
            </details>
          ) : (
            <pre className="rounded-lg border border-amber-200 bg-amber-100/40 p-2 text-[11px] whitespace-pre-wrap break-words text-amber-900">
              {preview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ToolWorkflowCard({ cards }: { cards: WorkflowToolCard[] }) {
  const chain = cards
    .map((card) => card.name.trim())
    .filter((name) => name.length > 0)
    .join(' \u2192 ');

  return (
    <details className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800 font-semibold">
          <Wrench className="h-3.5 w-3.5" />
          <span>{t('chatToolWorkflow')}</span>
          <span className="font-mono text-[11px] text-amber-900/90">{chain || 'tool'}</span>
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{cards.length}</span>
          <span className="text-[11px] font-normal text-amber-700/90">{t('chatToolWorkflowDetails')}</span>
        </div>
      </summary>
      <div className="mt-3 space-y-2">
        {cards.map((card, index) => (
          <ToolCardView
            key={`${card.kind}-${card.callId ?? card.name}-${index}`}
            card={{ ...card, _workflowStep: index }}
          />
        ))}
      </div>
    </details>
  );
}

function ReasoningBlock({ reasoning, isUser }: { reasoning: string; isUser: boolean }) {
  return (
    <details className="mt-3">
      <summary className={cn('cursor-pointer text-xs', isUser ? 'text-primary-100' : 'text-gray-500')}>
        {t('chatReasoning')}
      </summary>
      <pre className={cn('mt-2 text-[11px] whitespace-pre-wrap break-words rounded-lg p-2', isUser ? 'bg-primary-700/60' : 'bg-gray-100')}>
        {reasoning}
      </pre>
    </details>
  );
}

function MessageCard({ message }: { message: SessionMessageView }) {
  const role = normalizeChatRole(message);
  const primaryText = extractMessageText(message.content).trim();
  const primaryReasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content.trim() : '';
  const toolCards = extractToolCards(message);
  const isUser = role === 'user';
  const shouldRenderPrimaryText = Boolean(primaryText) && !(role === 'tool' && toolCards.length > 0);

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 shadow-sm',
        isUser
          ? 'bg-primary text-white border-primary'
          : role === 'assistant'
            ? 'bg-white text-gray-900 border-gray-200'
            : 'bg-orange-50/70 text-gray-900 border-orange-200/80'
      )}
    >
      {shouldRenderPrimaryText && <MarkdownBlock text={primaryText} role={role} />}
      {primaryReasoning && <ReasoningBlock reasoning={primaryReasoning} isUser={isUser} />}
      {toolCards.length > 0 && (
        <div className={cn('space-y-2', (shouldRenderPrimaryText || primaryReasoning) && 'mt-3')}>
          {toolCards.length > 1 ? (
            <ToolWorkflowCard cards={toolCards} />
          ) : (
            toolCards.map((card, index) => (
              <ToolCardView
                key={`${card.kind}-${card.name}-${card.callId ?? index}`}
                card={{ ...card }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AssistantTurnCard({ item }: { item: ChatTimelineAssistantTurnItem }) {
  const renderedSegments: ReactNode[] = [];
  let index = 0;
  while (index < item.segments.length) {
    const segment = item.segments[index];
    if (!segment) {
      index += 1;
      continue;
    }
    if (segment.kind === 'assistant_message') {
      const hasText = Boolean(segment.text);
      const hasReasoning = Boolean(segment.reasoning);
      if (hasText || hasReasoning) {
        renderedSegments.push(
          <div key={`${segment.key}-${index}`}>
            {hasText && <MarkdownBlock text={segment.text} role="assistant" />}
            {hasReasoning && <ReasoningBlock reasoning={segment.reasoning} isUser={false} />}
          </div>
        );
      }
      index += 1;
      continue;
    }

    const groupedCards: WorkflowToolCard[] = [];
    let cursor = index;
    while (cursor < item.segments.length) {
      const current = item.segments[cursor];
      if (!current || current.kind !== 'tool_card') {
        break;
      }
      groupedCards.push(current.card);
      cursor += 1;
    }
    if (groupedCards.length > 1) {
      renderedSegments.push(<ToolWorkflowCard key={`workflow-${segment.key}-${index}`} cards={groupedCards} />);
    } else if (groupedCards.length === 1) {
      renderedSegments.push(<ToolCardView key={`${segment.key}-${index}`} card={groupedCards[0]} />);
    }
    index = cursor;
  }

  return (
    <div className="rounded-2xl border px-4 py-3 shadow-sm bg-white text-gray-900 border-gray-200">
      <div className="space-y-3">{renderedSegments}</div>
    </div>
  );
}

export function ChatThread({ events, isSending, className }: ChatThreadProps) {
  const timeline = useMemo(() => buildChatTimeline(events), [events]);

  return (
    <div className={cn('space-y-5', className)}>
      {timeline.map((item) => {
        const role = item.kind === 'assistant_turn' ? 'assistant' : item.role;
        const isUser = role === 'user';
        return (
          <div key={item.key} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
            {!isUser && <RoleAvatar role={role} />}
            <div className={cn('max-w-[92%] min-w-[280px] space-y-2', isUser && 'flex flex-col items-end')}>
              {item.kind === 'assistant_turn' ? (
                <AssistantTurnCard item={item} />
              ) : (
                <MessageCard message={item.message} />
              )}
              <div className={cn('text-[11px] px-1', isUser ? 'text-primary-300' : 'text-gray-400')}>
                {roleTitle(role)} · {formatDateTime(item.timestamp)}
              </div>
            </div>
            {isUser && <RoleAvatar role={role} />}
          </div>
        );
      })}

      {isSending && (
        <div className="flex gap-3 justify-start">
          <RoleAvatar role="assistant" />
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
            {t('chatTyping')}
          </div>
        </div>
      )}
    </div>
  );
}
