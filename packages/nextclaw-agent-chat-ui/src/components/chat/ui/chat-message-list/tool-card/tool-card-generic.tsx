import { Wrench, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ToolCardRoot, ToolCardContent, ToolCardDetailSection } from './tool-card-root';
import { ToolCardHeader, ToolCardHeaderAction } from './tool-card-header';
import { useToolCardExpandedState } from './tool-card-views';

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
            <ToolCardDetailSection label={card.inputLabel?.trim() || 'Input'} tone="input">
              {input}
            </ToolCardDetailSection>
          ) : null}
          {hasInputSection && hasOutputSection ? <div className="h-2" /> : null}
          {hasOutputSection ? (
            <ToolCardDetailSection
              label={card.outputLabel?.trim() || 'Output'}
              tone={card.statusTone === 'error' ? 'error' : 'output'}
            >
              {output}
            </ToolCardDetailSection>
          ) : null}
        </ToolCardContent>
      ) : null}
    </ToolCardRoot>
  );
}
