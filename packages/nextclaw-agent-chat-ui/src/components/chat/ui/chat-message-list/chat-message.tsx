import { memo, type ReactNode } from "react";
import type {
  ChatFileOpenActionViewModel,
  ChatPanelAppCardViewModel,
  ChatMessageTexts,
  ChatToolActionViewModel,
  ChatMessageViewModel,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatMessageFile } from "./chat-message-file";
import { ChatReasoningBlock } from "./chat-reasoning-block";
import { ChatToolCard } from "./chat-tool-card";

type ChatMessageProps = {
  message: ChatMessageViewModel;
  texts: Pick<
    ChatMessageTexts,
    | "copyCodeLabel"
    | "copiedCodeLabel"
    | "attachmentOpenLabel"
    | "attachmentAttachedLabel"
    | "attachmentCategoryLabels"
  >;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
};

export const ChatMessage = memo(function ChatMessage({
  message,
  texts,
  onToolAction,
  onFileOpen,
  renderToolAgent,
  renderPanelAppCard,
}: ChatMessageProps) {
  const { role } = message;
  const isUser = role === "user";
  const isMessageInProgress =
    message.status === "pending" || message.status === "streaming";

  return (
    <div
      className={cn(
        "inline-block w-fit max-w-full rounded-2xl border px-4 shadow-sm",
        isUser
          ? "border-primary bg-primary py-3 text-white"
          : role === "assistant"
            ? "border-gray-200 bg-white pb-3 pt-4 text-gray-900"
            : "border-orange-200/80 bg-orange-50/70 py-3 text-gray-900",
      )}
    >
      <div className="space-y-2">
        {message.parts.map((part, index) => {
          const { type } = part;

          if (type === "markdown") {
            const { inlineTokens, text } = part;
            return (
              <ChatMessageMarkdown
                key={`markdown-${index}`}
                text={text}
                role={role}
                texts={texts}
                inlineTokens={inlineTokens}
                onFileOpen={onFileOpen}
              />
            );
          }
          if (type === "reasoning") {
            const { label, text } = part;
            return (
              <ChatReasoningBlock
                key={`reasoning-${index}`}
                label={label}
                text={text}
                isUser={isUser}
                isInProgress={
                  isMessageInProgress && index === message.parts.length - 1
                }
              />
            );
          }
          if (type === "tool-card") {
            const { card } = part;
            return (
              <div key={`tool-${index}`} className="mt-0.5">
                <ChatToolCard
                  card={card}
                  onToolAction={onToolAction}
                  onFileOpen={onFileOpen}
                  renderToolAgent={renderToolAgent}
                  renderPanelAppCard={renderPanelAppCard}
                />
              </div>
            );
          }
          if (type === "file") {
            const { file } = part;
            return (
              <ChatMessageFile
                key={`file-${index}`}
                file={file}
                isUser={isUser}
                texts={texts}
              />
            );
          }
          if (type === "unknown") {
            const { label, rawType, text } = part;
            return (
              <div
                key={`unknown-${index}`}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-600"
              >
                <div className="font-semibold text-gray-700">
                  {label}: {rawType}
                </div>
                {text ? <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-gray-500">{text}</pre> : null}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
});
