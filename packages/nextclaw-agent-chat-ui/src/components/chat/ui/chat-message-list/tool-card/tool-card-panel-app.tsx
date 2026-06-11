import { AppWindow } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  ChatPanelAppCardViewModel,
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { GenericToolCard } from './tool-card-views';
import { ToolCardRoot, ToolCardContent } from './tool-card-root';
import { ToolCardHeader, ToolCardHeaderAction } from './tool-card-header';

export function PanelAppInlineToolCard({
  card,
  onToolAction,
  renderPanelAppCard,
}: {
  card: ChatToolPartViewModel;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
}) {
  const { panelApp } = card;
  if (!panelApp) {
    return <GenericToolCard card={card} onToolAction={onToolAction} />;
  }

  return (
    <ToolCardRoot className="w-full sm:w-[420px] md:w-[560px]">
      <ToolCardHeader
        card={card}
        icon={AppWindow}
        expanded={false}
        canExpand={false}
        actionSlot={
          onToolAction ? (
            <ToolCardHeaderAction
              action={panelApp.action}
              onAction={onToolAction}
            />
          ) : undefined
        }
        onToggle={() => {}}
      />
      <ToolCardContent className="border-t border-amber-200/20 bg-white/80 p-0">
        {renderPanelAppCard ? renderPanelAppCard(panelApp) : null}
      </ToolCardContent>
    </ToolCardRoot>
  );
}
