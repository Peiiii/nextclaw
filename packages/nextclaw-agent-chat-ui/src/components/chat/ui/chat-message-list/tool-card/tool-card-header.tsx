import { ArrowUpRight, ChevronDown, ChevronRight, Eye, type LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import { ChatUiPrimitives } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
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
      toneClassName: 'border-sky-200/80 bg-white/85 text-sky-800 hover:bg-sky-50 focus-visible:ring-sky-300',
    };
  }

  return {
    icon: ArrowUpRight,
    label: action.label ?? (action.sessionKind === 'child' ? 'Open child session' : 'Open session'),
    toneClassName: 'border-amber-200/80 bg-white/80 text-amber-800 hover:bg-amber-50 focus-visible:ring-amber-300',
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
              'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              view.toneClassName,
            )}
            aria-label={view.label}
            title={view.label}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {view.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ToolCardHeader({ 
  card, 
  icon: Icon, 
  expanded, 
  canExpand,
  hideSummary = false,
  actionSlot,
  onToggle 
}: { 
  card: ChatToolPartViewModel; 
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

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors bg-transparent", 
        canExpand ? "cursor-pointer hover:bg-amber-100/30" : ""
      )}
      onClick={onToggle}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden font-mono text-amber-950/80">
        <Icon className="h-4 w-4 text-amber-600/80 shrink-0" strokeWidth={3} />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className="font-bold shrink-0 tracking-tight">{card.toolName}</span>
          {summaryPart && (
            <>
              <span className="text-amber-300 font-bold select-none shrink-0">›</span>
              <span className="block min-w-0 flex-1 truncate font-normal" title={summaryPart}>
                {summaryPart}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {actionSlot}
        <ToolStatusLabel card={card} />
        {canExpand && (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
          ) : (
            <ChevronRight className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
          )
        )}
      </div>
    </div>
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
