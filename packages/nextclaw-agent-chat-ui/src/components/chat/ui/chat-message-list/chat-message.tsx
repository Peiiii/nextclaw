import { memo, type ReactNode } from "react";
import type {
  ChatFileOpenActionViewModel,
  ChatMessageTexts,
  ChatToolActionViewModel,
  ChatMessageViewModel,
} from "../../view-models/chat-ui.types";
import { cn } from "../../internal/cn";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatMessageInlineContent } from "./chat-message-inline-content";
import { ChatMessageFile } from "./chat-message-file";
import { ChatReasoningBlock } from "./chat-reasoning-block";
import { ChatToolCard } from "./chat-tool-card";
import { ChatUnknownPart } from "./chat-unknown-part";

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
};

export const ChatMessage = memo(function ChatMessage(props: ChatMessageProps) {
  const { message, texts, onToolAction, onFileOpen, renderToolAgent } = props;
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
            return (
              <ChatMessageMarkdown
              key={`markdown-${index}`}
              text={part.text}
              role={role}
              texts={texts}
              onFileOpen={onFileOpen}
            />
          );
        }
          if (type === "inline-content") {
            return (
              <ChatMessageInlineContent
                key={`inline-content-${index}`}
                segments={part.segments}
                role={role}
                texts={texts}
                onFileOpen={onFileOpen}
              />
            );
          }
          if (type === "reasoning") {
            return (
              <ChatReasoningBlock
                key={`reasoning-${index}`}
                label={part.label}
                text={part.text}
                isUser={isUser}
                isInProgress={
                  isMessageInProgress && index === message.parts.length - 1
                }
              />
            );
          }
          if (type === "tool-card") {
            return (
              <div key={`tool-${index}`} className="mt-0.5">
                <ChatToolCard
                  card={part.card}
                  onToolAction={onToolAction}
                  onFileOpen={onFileOpen}
                  renderToolAgent={renderToolAgent}
                />
              </div>
            );
          }
          if (type === "file") {
            return (
              <ChatMessageFile
                key={`file-${index}`}
                file={part.file}
                isUser={isUser}
                texts={texts}
              />
            );
          }
          if (type === "unknown") {
            return (
              <ChatUnknownPart
                key={`unknown-${index}`}
                label={part.label}
                rawType={part.rawType}
                text={part.text}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
});
