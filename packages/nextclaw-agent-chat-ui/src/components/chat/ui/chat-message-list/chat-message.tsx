import type {
  ChatMessageTexts,
  ChatMessageViewModel,
} from "../../view-models/chat-ui.types";
import { cn } from "../../internal/cn";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatMessageFile } from "./chat-message-file";
import { ChatReasoningBlock } from "./chat-reasoning-block";
import { ChatToolCard } from "./chat-tool-card";
import { ChatUnknownPart } from "./chat-unknown-part";

type ChatMessageProps = {
  message: ChatMessageViewModel;
  texts: Pick<ChatMessageTexts, "copyCodeLabel" | "copiedCodeLabel">;
};

export function ChatMessage(props: ChatMessageProps) {
  const { message, texts } = props;
  const { role } = message;
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "inline-block w-fit max-w-full rounded-2xl border px-4 py-3 shadow-sm",
        isUser
          ? "border-primary bg-primary text-white"
          : role === "assistant"
            ? "border-gray-200 bg-white text-gray-900"
            : "border-orange-200/80 bg-orange-50/70 text-gray-900",
      )}
    >
      <div className="space-y-2">
        {message.parts.map((part, index) => {
          if (part.type === "markdown") {
            return (
              <ChatMessageMarkdown
                key={`markdown-${index}`}
                text={part.text}
                role={role}
                texts={texts}
              />
            );
          }
          if (part.type === "reasoning") {
            return (
              <ChatReasoningBlock
                key={`reasoning-${index}`}
                label={part.label}
                text={part.text}
                isUser={isUser}
              />
            );
          }
          if (part.type === "tool-card") {
            return (
              <div key={`tool-${index}`} className="mt-0.5">
                <ChatToolCard card={part.card} />
              </div>
            );
          }
          if (part.type === "file") {
            return (
              <ChatMessageFile
                key={`file-${index}`}
                file={part.file}
                isUser={isUser}
              />
            );
          }
          if (part.type === "unknown") {
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
}
