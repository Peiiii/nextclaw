import type {
  ChatFileOpenActionViewModel,
  ChatPanelAppCardViewModel,
  ChatToolActionViewModel,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import type { ReactNode } from "react";
import { ChatToolCard } from "./chat-tool-card";
import { ChatCollapsibleMetaSummary } from "./chat-collapsible-meta-summary";
import type { ChatToolActivityGroupViewModel } from "./chat-tool-activity-group.utils";

export function ChatToolActivityGroup({
  group,
  onToolAction,
  onFileOpen,
  renderToolAgent,
  renderPanelAppCard,
}: {
  group: ChatToolActivityGroupViewModel;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
}) {
  return (
    <details className="group/tool-activity">
      <ChatCollapsibleMetaSummary
        openGroup="tool-activity"
        label={group.label}
      />
      <div className="space-y-1 pt-1">
        {group.parts.map((part, index) => (
          <div key={`tool-group-item-${group.startIndex + index}`} className="mt-0.5">
            <ChatToolCard
              card={part.card}
              onToolAction={onToolAction}
              onFileOpen={onFileOpen}
              renderToolAgent={renderToolAgent}
              renderPanelAppCard={renderPanelAppCard}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
