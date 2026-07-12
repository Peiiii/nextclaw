import { memo, type ReactNode } from "react";
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
import { ChatToolActivityGroup } from "./chat-tool-activity-group";
import { ChatCollapsibleMetaSummary } from "./chat-collapsible-meta-summary";
import {
  groupConsecutiveToolParts,
  type ChatToolActivityGroupLabels,
} from "./chat-tool-activity-group.utils";

type ChatMessageProps = {
  message: ChatMessageViewModel;
  texts: Pick<
    ChatMessageTexts,
    | "copyCodeLabel"
    | "copiedCodeLabel"
    | "attachmentOpenLabel"
    | "attachmentAttachedLabel"
    | "attachmentCategoryLabels"
    | "toolActivitySegmentTemplates"
    | "toolActivityFailedLabel"
    | "toolActivityCancelledLabel"
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

const DEFAULT_TOOL_ACTIVITY_LABELS: ChatToolActivityGroupLabels = {
  segmentTemplates: {
    read: { one: "Read 1 file", other: "Read {count} files" },
    edit: { one: "Edit 1 file", other: "Edit {count} files" },
    search: { one: "Search 1 time", other: "Search {count} times" },
    bash: { one: "Run 1 command", other: "Run {count} commands" },
    web: { one: "Open 1 page", other: "Open {count} pages" },
    agent: { one: "Start 1 subtask", other: "Start {count} subtasks" },
    panel: { one: "Show 1 result", other: "Show {count} results" },
    other: { one: "Use 1 tool", other: "Use {count} tools" },
  },
  failedLabel: "failed",
  cancelledLabel: "cancelled",
};

function resolveToolActivityLabels(
  texts: ChatMessageProps["texts"],
): ChatToolActivityGroupLabels {
  return {
    segmentTemplates: {
      ...DEFAULT_TOOL_ACTIVITY_LABELS.segmentTemplates,
      ...(texts.toolActivitySegmentTemplates ?? {}),
    },
    failedLabel:
      texts.toolActivityFailedLabel ?? DEFAULT_TOOL_ACTIVITY_LABELS.failedLabel,
    cancelledLabel:
      texts.toolActivityCancelledLabel ??
      DEFAULT_TOOL_ACTIVITY_LABELS.cancelledLabel,
  };
}

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

function renderMessageParts(params: {
  parts: ChatMessagePartViewModel[];
  role: ChatMessageViewModel["role"];
  isUser: boolean;
  isInProgress: boolean;
  texts: ChatMessageProps["texts"];
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderInlineDisplay?: (
    display: ChatInlineDisplayViewModel,
  ) => ReactNode | undefined;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
  indexOffset?: number;
}): ReactNode[] {
  const {
    isInProgress,
    isUser,
    onFileOpen,
    onToolAction,
    parts,
    renderInlineDisplay,
    renderPanelAppCard,
    renderToolAgent,
    role,
    texts,
    indexOffset = 0,
  } = params;
  const labels = resolveToolActivityLabels(texts);
  const blocks = groupConsecutiveToolParts(parts, labels);

  return blocks.map((block) => {
    if (block.kind === "tool-group") {
      return (
        <ChatToolActivityGroup
          key={block.key}
          group={block.group}
          onToolAction={onToolAction}
          onFileOpen={onFileOpen}
          renderToolAgent={renderToolAgent}
          renderPanelAppCard={renderPanelAppCard}
        />
      );
    }

    return renderChatMessagePart({
      part: block.part,
      index: indexOffset + block.index,
      role,
      isUser,
      isInProgress,
      isLastPart: indexOffset + block.index === indexOffset + parts.length - 1,
      texts,
      onToolAction,
      onFileOpen,
      renderInlineDisplay,
      renderToolAgent,
      renderPanelAppCard,
    });
  });
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

  return (
    <div
      className={cn(
        "inline-block w-fit max-w-full rounded-2xl border px-4 shadow-sm has-[[data-chat-message-wide-content=true]]:w-full",
        isUser
          ? "nextclaw-chat-message-user rounded-[1.45rem] border-primary bg-primary py-2.5 text-primary-foreground shadow-none"
          : role === "assistant"
            ? "border-border bg-card pb-3 pt-4 text-card-foreground"
            : "border-border bg-muted/45 py-3 text-foreground",
      )}
    >
      <div className="space-y-2">
        {processSplit ? (
          <>
            <details className="group/process">
              <ChatCollapsibleMetaSummary
                openGroup="process"
                label={message.processSummary?.label}
                className="border-b border-border/60 pb-2"
              />
              <div className="space-y-2 pt-2">
                {renderMessageParts({
                  parts: processSplit.processParts,
                  role,
                  isUser,
                  isInProgress,
                  texts,
                  onToolAction,
                  onFileOpen,
                  renderInlineDisplay,
                  renderToolAgent,
                  renderPanelAppCard,
                })}
              </div>
            </details>
            {renderMessageParts({
              parts: processSplit.finalParts,
              role,
              isUser,
              isInProgress,
              texts,
              onToolAction,
              onFileOpen,
              renderInlineDisplay,
              renderToolAgent,
              renderPanelAppCard,
              indexOffset: processSplit.processParts.length,
            })}
          </>
        ) : (
          renderMessageParts({
            parts: message.parts,
            role,
            isUser,
            isInProgress,
            texts,
            onToolAction,
            onFileOpen,
            renderInlineDisplay,
            renderToolAgent,
            renderPanelAppCard,
          })
        )}
      </div>
    </div>
  );
});
