import { memo, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  ChatFileOpenActionViewModel,
  ChatInlineDisplayViewModel,
  ChatPanelAppCardViewModel,
  ChatMessageTexts,
  ChatMessagePartViewModel,
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
  renderInlineDisplay?: (
    display: ChatInlineDisplayViewModel,
  ) => ReactNode | undefined;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
};

type ChatMessageProcessSplit = {
  processParts: ChatMessagePartViewModel[];
  finalParts: ChatMessagePartViewModel[];
};

type RenderChatMessagePartParams = {
  part: ChatMessagePartViewModel;
  index: number;
  role: ChatMessageViewModel["role"];
  isUser: boolean;
  isInProgress: boolean;
  isLastPart: boolean;
  texts: ChatMessageProps["texts"];
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderInlineDisplay?: (
    display: ChatInlineDisplayViewModel,
  ) => ReactNode | undefined;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
};

function isMessageInProgress(status?: string): boolean {
  return status === "pending" || status === "streaming";
}

function isProcessPart(part: ChatMessagePartViewModel): boolean {
  return part.type === "reasoning" || part.type === "tool-card";
}

function splitAssistantProcess(message: ChatMessageViewModel): ChatMessageProcessSplit | null {
  if (
    message.role !== "assistant" ||
    !message.processSummary ||
    isMessageInProgress(message.status)
  ) {
    return null;
  }
  let lastProcessPartIndex = -1;
  for (let index = message.parts.length - 1; index >= 0; index -= 1) {
    if (isProcessPart(message.parts[index]!)) {
      lastProcessPartIndex = index;
      break;
    }
  }
  if (lastProcessPartIndex < 0 || lastProcessPartIndex >= message.parts.length - 1) {
    return null;
  }
  return {
    processParts: message.parts.slice(0, lastProcessPartIndex + 1),
    finalParts: message.parts.slice(lastProcessPartIndex + 1),
  };
}

function renderChatMessagePart({
  index,
  isInProgress,
  isLastPart,
  isUser,
  onFileOpen,
  onToolAction,
  part,
  renderInlineDisplay,
  renderPanelAppCard,
  renderToolAgent,
  role,
  texts,
}: RenderChatMessagePartParams): ReactNode {
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
        renderInlineDisplay={renderInlineDisplay}
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
        isInProgress={isInProgress && isLastPart}
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
        className="rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground"
      >
        <div className="font-semibold text-foreground">
          {label}: {rawType}
        </div>
        {text ? <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{text}</pre> : null}
      </div>
    );
  }
  return null;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  texts,
  onToolAction,
  onFileOpen,
  renderInlineDisplay,
  renderToolAgent,
  renderPanelAppCard,
}: ChatMessageProps) {
  const { role } = message;
  const isUser = role === "user";
  const isInProgress = isMessageInProgress(message.status);
  const processSplit = splitAssistantProcess(message);
  const renderPart = (part: ChatMessagePartViewModel, index: number) =>
    renderChatMessagePart({
      part,
      index,
      role,
      isUser,
      isInProgress,
      isLastPart: index === message.parts.length - 1,
      texts,
      onToolAction,
      onFileOpen,
      renderInlineDisplay,
      renderToolAgent,
      renderPanelAppCard,
    });

  return (
    <div
      className={cn(
        "inline-block w-fit max-w-full rounded-2xl border px-4 shadow-sm has-[[data-chat-message-wide-content=true]]:w-full",
        isUser
          ? "border-primary bg-primary py-3 text-primary-foreground"
          : role === "assistant"
            ? "border-border bg-card pb-3 pt-4 text-card-foreground"
            : "border-border bg-muted/45 py-3 text-foreground",
      )}
    >
      <div className="space-y-2">
        {processSplit ? (
          <>
            <details className="group/process text-xs text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 border-b border-border/60 pb-2 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-3.5 w-3.5 group-open/process:hidden" strokeWidth={2.5} />
                <ChevronDown className="hidden h-3.5 w-3.5 group-open/process:block" strokeWidth={2.5} />
                <span>{message.processSummary?.label}</span>
              </summary>
              <div className="space-y-2 pt-2">
                {processSplit.processParts.map(renderPart)}
              </div>
            </details>
            {processSplit.finalParts.map((part, index) =>
              renderPart(part, processSplit.processParts.length + index),
            )}
          </>
        ) : (
          message.parts.map(renderPart)
        )}
      </div>
    </div>
  );
});
