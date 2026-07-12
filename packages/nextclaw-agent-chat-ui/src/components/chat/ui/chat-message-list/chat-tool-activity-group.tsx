import type {
  ChatFileOpenActionViewModel,
  ChatPanelAppCardViewModel,
  ChatToolActionViewModel,
  ChatMessageTexts,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { useState, type ReactNode } from "react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { ChatToolCard } from "./chat-tool-card";
import { ChatCollapsibleMetaSummary } from "./chat-collapsible-meta-summary";
import { ChatReasoningBlock } from "./chat-reasoning-block";
import type { ChatToolActivityGroupViewModel } from "./chat-tool-activity-group.utils";

export function ChatToolActivityGroup({
  group,
  isUser,
  reasoningCharacterCountTemplates,
  toolStatusLabels,
  onToolAction,
  onFileOpen,
  renderToolAgent,
  renderPanelAppCard,
}: {
  group: ChatToolActivityGroupViewModel;
  isUser: boolean;
  reasoningCharacterCountTemplates?: ChatMessageTexts["reasoningCharacterCountTemplates"];
  toolStatusLabels?: ChatMessageTexts["toolStatusLabels"];
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toolCount = group.parts.filter((part) => part.type === "tool-card").length;
  const showWorkflowRail = open && toolCount > 1;

  return (
    <div className="group/tool-activity">
      <ChatCollapsibleMetaSummary
        openGroup="tool-activity"
        open={open}
        label={group.label}
        onClick={() => setOpen((current) => !current)}
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
                  <div
                    aria-hidden="true"
                    data-tool-workflow-rail="true"
                    className={cn(
                      "pointer-events-none absolute left-[0.575em] w-px -translate-x-1/2 bg-border/70",
                      index === 0
                        ? "bottom-0 top-[0.86em]"
                        : isLast
                          ? "top-0 h-[0.86em]"
                          : "inset-y-0",
                    )}
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
                  <div className="pl-[calc(1.15em+0.375rem)]">
                    <ChatReasoningBlock
                      label={part.label}
                      text={part.text}
                      characterCountTemplates={reasoningCharacterCountTemplates}
                      isUser={isUser}
                      isInProgress={false}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
