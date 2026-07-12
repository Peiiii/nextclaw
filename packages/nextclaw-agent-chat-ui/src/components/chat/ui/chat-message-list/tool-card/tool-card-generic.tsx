import { Wrench, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import { ToolCardRoot, ToolCardContent } from './tool-card-root';
import { ToolCardHeader, ToolCardHeaderAction } from './tool-card-header';
import { useToolCardExpandedState } from './tool-card-views';

function GenericToolSection({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'input' | 'output' | 'error';
  children: ReactNode;
}) {
  const tones = {
    input: { dot: 'bg-muted-foreground/60', body: 'text-foreground' },
    output: { dot: 'bg-primary/70', body: 'text-foreground' },
    error: { dot: 'bg-rose-500/80', body: 'text-rose-950/85' },
  } as const;
  const style = tones[tone];

  return (
    <section className="overflow-hidden rounded-md border border-border/70 bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground">
        <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
        <span className="normal-case tracking-normal">{label}</span>
      </div>
      <div className="w-full overflow-hidden">
        <pre
          className={cn(
            'w-full max-w-full min-w-0 max-h-64 overflow-x-auto overflow-y-auto px-2.5 py-2 font-mono text-[12px] leading-relaxed whitespace-pre custom-scrollbar',
            style.body,
          )}
        >
          {children}
        </pre>
      </div>
    </section>
  );
}

function buildToolActionSlot(
  card: ChatToolPartViewModel,
  onToolAction?: (action: ChatToolActionViewModel) => void,
  renderToolAgent?: (agentId: string) => ReactNode,
): ReactNode | undefined {
  const agentAction = card.agentId && renderToolAgent
    ? renderToolAgent(card.agentId)
    : null;
  const toolAction = card.action && onToolAction
    ? <ToolCardHeaderAction action={card.action} onAction={onToolAction} />
    : null;
  return agentAction || toolAction ? <>{agentAction}{toolAction}</> : undefined;
}

export function GenericToolCard({
  card,
  toolLabel,
  icon: Icon = Wrench,
  onToolAction,
  renderToolAgent,
}: {
  card: ChatToolPartViewModel;
  toolLabel?: string;
  icon?: LucideIcon;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
}) {
  const input = card.input?.trim() ?? '';
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  const hasInputSection = input.length > 0;
  const hasOutputSection = output.length > 0;
  const hasContent = hasInputSection || hasOutputSection;
  const actionSlot = buildToolActionSlot(card, onToolAction, renderToolAgent);
  const { expanded, onToggle } = useToolCardExpandedState({
    canExpand: hasContent || isRunning,
    isRunning,
    autoExpandWhileRunning: false,
    statusTone: card.statusTone,
  });

  return (
    <ToolCardRoot>
      <ToolCardHeader
        card={card}
        toolLabel={toolLabel}
        icon={Icon}
        expanded={expanded}
        canExpand={hasContent || isRunning}
        actionSlot={actionSlot}
        onToggle={onToggle}
      />
      {expanded && hasContent ? (
        <ToolCardContent className="bg-transparent py-0">
          {hasInputSection ? (
            <GenericToolSection label={card.inputLabel?.trim() || 'Input'} tone="input">
              {input}
            </GenericToolSection>
          ) : null}
          {hasInputSection && hasOutputSection ? <div className="h-2" /> : null}
          {hasOutputSection ? (
            <GenericToolSection
              label={card.outputLabel?.trim() || 'Output'}
              tone={card.statusTone === 'error' ? 'error' : 'output'}
            >
              {output}
            </GenericToolSection>
          ) : null}
        </ToolCardContent>
      ) : null}
    </ToolCardRoot>
  );
}
