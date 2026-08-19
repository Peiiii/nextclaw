import type {
  ChatFileOpenActionViewModel,
  ChatPanelAppCardViewModel,
  ChatToolActionViewModel,
  ChatMessageTexts,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { useEffect, useState, type ReactNode } from "react";
import { Workflow } from "lucide-react";
import { ChatToolCard } from "./chat-tool-card";
import { ChatCollapsibleMetaSummary } from "./chat-collapsible-meta-summary";
import { ChatReasoningBlock } from "./chat-reasoning-block";
import { ChatProcessWorkflowRail } from "./chat-process-meta-row";
import type { ChatToolActivityGroupViewModel } from "./chat-tool-activity-group.utils";

const TOOL_ACTIVITY_INITIAL_VISIBLE_PARTS = 40;

export function ChatToolActivityGroup({
  group,
  open,
  isUser,
  reasoningCharacterCountTemplates,
  toolStatusLabels,
  showMoreTemplate,
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
  showMoreTemplate?: string;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  const [visiblePartCount, setVisiblePartCount] = useState(TOOL_ACTIVITY_INITIAL_VISIBLE_PARTS);
  useEffect(() => {
    setVisiblePartCount(TOOL_ACTIVITY_INITIAL_VISIBLE_PARTS);
  }, [group.key]);
  const toolCount = group.parts.filter((part) => part.type === "tool-card").length;
  const showWorkflowRail = open && toolCount > 1;
  const visibleParts = group.parts.slice(0, visiblePartCount);
  const remainingPartCount = Math.max(0, group.parts.length - visibleParts.length);
  const nextPartCount = Math.min(TOOL_ACTIVITY_INITIAL_VISIBLE_PARTS, remainingPartCount);
  const showMoreLabel = (showMoreTemplate ?? "Show next {count} ({remaining} remaining)")
    .replace("{count}", String(nextPartCount))
    .replace("{remaining}", String(remainingPartCount));

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
          {visibleParts.map((part, index) => {
            const isLast = index === visibleParts.length - 1;
            return (
              <div
                key={
                  part.type === "tool-card" && part.card.toolCallId
                    ? `tool-group-call-${part.card.toolCallId}`
                    : `tool-group-item-${group.startIndex + index}`
                }
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
          {remainingPartCount > 0 ? (
            <button
              type="button"
              className="ml-6 mt-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
              onClick={() => setVisiblePartCount((current) => current + TOOL_ACTIVITY_INITIAL_VISIBLE_PARTS)}
            >
              {showMoreLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
