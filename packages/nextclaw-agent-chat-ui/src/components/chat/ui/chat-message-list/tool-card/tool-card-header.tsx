import { ArrowUpRight, ChevronRight, Eye, type LucideIcon } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import { ChatUiPrimitives } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import {
  ChatProcessLeadingIcon,
  ChatProcessMetaRow,
} from '@agent-chat-ui/components/chat/ui/chat-message-list/chat-process-meta-row';
import { ToolStatusLabel } from './tool-card-status';
import type {
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

function resolveToolCardActionView(action: ChatToolActionViewModel): {
  icon: LucideIcon;
  label: string;
  toneClassName: string;
} {
  if (action.kind === 'show-content') {
    return {
      icon: Eye,
      label: action.label,
      toneClassName:
        'border-border/70 bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-primary/35',
    };
  }

  return {
    icon: ArrowUpRight,
    label: action.label ?? (action.sessionKind === 'child' ? 'Open child session' : 'Open session'),
    toneClassName:
      'border-border/70 bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-primary/35',
  };
}

function ToolCardActionButton({
  action,
  onAction,
}: {
  action: ChatToolActionViewModel;
  onAction: (action: ChatToolActionViewModel) => void;
}) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  const view = resolveToolCardActionView(action);
  const Icon = view.icon;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAction(action);
  };

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              view.toneClassName,
            )}
            aria-label={view.label}
            title={view.label}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {view.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function humanizeToolName(toolName: string): string {
  return toolName
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function handleToolHeaderKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onToggle: () => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }
  event.preventDefault();
  onToggle();
}

function ToolHeaderSummary({
  label,
  summary,
}: {
  label: string;
  summary: string;
}) {
  return (
    <span className="min-w-0 shrink truncate">
      {label}
      {summary ? (
        <>
          <span className="mx-1.5 select-none text-muted-foreground/45">·</span>
          <span title={summary}>{summary}</span>
        </>
      ) : null}
    </span>
  );
}

function ToolHeaderChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-[1.15em] w-[1.15em] shrink-0 items-center justify-center text-muted-foreground/80 transition-opacity',
        expanded
          ? 'opacity-100'
          : 'opacity-0 group-hover/process-row:opacity-100 group-focus-within/process-row:opacity-100',
      )}
    >
      <ChevronRight
        className={cn(
          'h-[1.05em] w-[1.05em] transition-transform',
          expanded && 'rotate-90',
        )}
        strokeWidth={2.25}
      />
    </span>
  );
}

function ToolHeaderChangeSummary({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  if (additions === 0 && deletions === 0) {
    return null;
  }
  const accessibleLabel = [
    additions > 0 ? `+${additions}` : null,
    deletions > 0 ? `-${deletions}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground/75"
      aria-label={accessibleLabel}
    >
      {additions > 0 ? (
        <span className="transition-colors group-hover/process-row:text-emerald-600">
          +{additions}
        </span>
      ) : null}
      {deletions > 0 ? (
        <span className="transition-colors group-hover/process-row:text-rose-600">
          -{deletions}
        </span>
      ) : null}
    </span>
  );
}

export function ToolCardHeader({
  card,
  toolLabel,
  changeSummary,
  icon: Icon,
  expanded,
  canExpand,
  hideSummary = false,
  actionSlot,
  onToggle,
}: {
  card: ChatToolPartViewModel;
  toolLabel?: string;
  changeSummary?: { additions: number; deletions: number };
  icon: LucideIcon;
  expanded: boolean;
  canExpand: boolean;
  hideSummary?: boolean;
  actionSlot?: ReactNode;
  onToggle: () => void;
}) {
  const summaryPart = hideSummary
    ? ''
    : card.summary?.replace(/^(command|path|args|query|input):\s*/i, '') ?? '';
  const displayLabel = toolLabel ?? humanizeToolName(card.toolName);

  return (
    <ChatProcessMetaRow
      interactive={canExpand}
      onClick={canExpand ? () => onToggle() : undefined}
      role={canExpand ? 'button' : undefined}
      tabIndex={canExpand ? 0 : undefined}
      onKeyDown={
        canExpand
          ? (event: KeyboardEvent<HTMLElement>) =>
              handleToolHeaderKeyDown(event, onToggle)
          : undefined
      }
    >
      <ChatProcessLeadingIcon className="relative z-[1] rounded-sm bg-card">
        <Icon className="h-[1.05em] w-[1.05em]" strokeWidth={2.25} />
      </ChatProcessLeadingIcon>

      {/*
        One flowing cluster: text → status → expand chevron.
        No flex-1 spacer, so chevron stays tight against the overview text
        instead of jumping to the far right edge.
      */}
      <ToolHeaderSummary label={displayLabel} summary={summaryPart} />
      {changeSummary ? <ToolHeaderChangeSummary {...changeSummary} /> : null}
      <ToolStatusLabel card={card} iconOnly={Boolean(toolLabel)} />
      {canExpand ? <ToolHeaderChevron expanded={expanded} /> : null}
      {actionSlot ? (
        <span className="inline-flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/process-row:opacity-100 group-focus-within/process-row:opacity-100">
          {actionSlot}
        </span>
      ) : null}
    </ChatProcessMetaRow>
  );
}

export function ToolCardHeaderAction({
  action,
  onAction,
}: {
  action: ChatToolActionViewModel;
  onAction: (action: ChatToolActionViewModel) => void;
}) {
  return <ToolCardActionButton action={action} onAction={onAction} />;
}
