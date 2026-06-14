import type { ReactNode } from 'react';
import type {
  ChatPanelAppCardViewModel,
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { GenericToolCard } from './tool-card-views';

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
  if (renderPanelAppCard) {
    return renderPanelAppCard(panelApp);
  }

  return <GenericToolCard card={card} onToolAction={onToolAction} />;
}
