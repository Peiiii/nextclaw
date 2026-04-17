import { ArrowUpRight, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../../../internal/cn';
import { ToolStatusLabel } from './tool-card-status';
import type {
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '../../../view-models/chat-ui.types';

function ToolCardSessionActionButton({
  action,
  onAction,
}: {
  action: ChatToolActionViewModel;
  onAction: (action: ChatToolActionViewModel) => void;
}) {
  const isChildSession = action.sessionKind === 'child';
  const label = isChildSession ? 'Open child session' : 'Open session';

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAction(action);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors',
        'border-amber-200/80 bg-white/80 text-amber-800 hover:bg-amber-50',
      )}
      aria-label={label}
      title={label}
    >
      <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
    </button>
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

export function ToolCardHeaderSessionAction({
  action,
  onAction,
}: {
  action: ChatToolActionViewModel;
  onAction: (action: ChatToolActionViewModel) => void;
}) {
  return <ToolCardSessionActionButton action={action} onAction={onAction} />;
}
