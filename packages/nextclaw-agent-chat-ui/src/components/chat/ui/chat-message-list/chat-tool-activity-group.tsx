import type {
  ChatFileOpenActionViewModel,
  ChatPanelAppCardViewModel,
  ChatToolActionViewModel,
  ChatMessageTexts,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { type ReactNode } from "react";
import { Workflow } from "lucide-react";
import { ChatToolCard } from "./chat-tool-card";
import { ChatCollapsibleMetaSummary } from "./chat-collapsible-meta-summary";
import { ChatReasoningBlock } from "./chat-reasoning-block";
import { ChatProcessWorkflowRail } from "./chat-process-meta-row";
import type { ChatToolActivityGroupViewModel } from "./chat-tool-activity-group.utils";

export function ChatToolActivityGroup({
  group,
  open,
  isUser,
  reasoningCharacterCountTemplates,
  toolStatusLabels,
  onToolAction,
  onFileOpen,
  renderToolAgent,
  renderPanelAppCard,
  onOpenChange,
}: {
  group: ChatToolActivityGroupViewModel;
  open: boolean;
  isUser: boolean;
  reasoningCharacterCountTemplates?: ChatMessageTexts["reasoningCharacterCountTemplates"];
  toolStatusLabels?: ChatMessageTexts["toolStatusLabels"];
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  const toolCount = group.parts.filter((part) => part.type === "tool-card").length;
  const showWorkflowRail = open && toolCount > 1;

  return (
    <div className="group/tool-activity">
      <ChatCollapsibleMetaSummary
        openGroup="tool-activity"
        open={open}
        icon={Workflow}
        leadingIconClassName="bg-card"
        label={group.label}
        onClick={() => onOpenChange(!open)}
      />
      {open ? (
        <div className="text-[0.925rem] leading-[1.72]">
          {group.parts.map((part, index) => {
            const isLast = index === group.parts.length - 1;
            return (
              <div
                key={`tool-group-item-${group.startIndex + index}`}
                className="relative min-w-0"
              >
                {showWorkflowRail ? (
                  <ChatProcessWorkflowRail
                    position={index === 0 ? "first" : isLast ? "last" : "middle"}
                  />
                ) : null}
                {part.type === "tool-card" ? (
                  <ChatToolCard
                    card={part.card}
                    toolStatusLabels={toolStatusLabels}
                    onToolAction={onToolAction}
                    onFileOpen={onFileOpen}
                    renderToolAgent={renderToolAgent}
                    renderPanelAppCard={renderPanelAppCard}
                  />
                ) : (
                  <ChatReasoningBlock
                    label={part.label}
                    text={part.text}
                    characterCountTemplates={reasoningCharacterCountTemplates}
                    isUser={isUser}
                    isInProgress={false}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
