import { useCallback, useMemo } from "react";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  type ChatInlineDisplayViewModel,
  type ChatInlineTokenViewModel,
  type ChatMessageViewModel,
  type ChatPanelAppCardViewModel,
  ChatMessageList,
} from "@nextclaw/agent-chat-ui";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { adaptChatMessage, type ChatMessageSource } from "@/features/chat/features/message/utils/chat-message.utils";
import { buildChatMessageProcessSummary } from "@/features/chat/features/message/utils/chat-message-process-summary.utils";
import { buildChatMessageExecutionPresentation } from "@/features/chat/features/message/utils/chat-message-execution-summary.utils";
import {
  buildChatMessageAdapterTexts,
  buildChatMessageExecutionLabels,
  buildChatMessageTexts,
} from "@/features/chat/features/message/utils/chat-message-texts.utils";
import {
  readInlineTokensFromMetadata,
  resolveWorkspaceReferencePath,
} from "@/features/chat/features/input/utils/chat-inline-token.utils";
import { adaptNcpMessageToUiMessage } from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import {
  readContextCompactionTimeline,
  type ContextCompactionTimelineView,
} from "@/features/chat/features/session/utils/ncp-session-context-metadata.utils";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { ChatInlineFilePreview } from "@/features/chat/features/message/components/chat-inline-file-preview";
import { ChatInlinePanelAppCard } from "@/features/chat/features/message/components/chat-inline-panel-app-card";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatMessageLayoutStore } from "@/features/chat/stores/chat-message-layout.store";
import { useNcpChatSelectedSession } from "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import {
  buildSessionTypeOptions,
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { useI18n } from "@/app/components/i18n-provider";
import { buildServerPathContentUrl } from "@/shared/lib/api";
import { formatDateTime, t } from "@/shared/lib/i18n";

type ChatMessageListContainerProps = {
  messages: readonly NcpMessage[];
  isSending: boolean;
  sessionKey: string | null;
  className?: string;
};

const INHERITED_FROM_SESSION_METADATA_KEY = "inherited_from_session_id";

const messageViewModelCache = new WeakMap<
  NcpMessage,
  {
    language: string;
    processSummaryLabel: string | null;
    executionPresentationKey: string | null;
    viewModel: ChatMessageViewModel;
  }
>();

function renderChatInlineDisplay(display: ChatInlineDisplayViewModel) {
  if (display.target.type !== "panel_app") {
    return undefined;
  }
  return (
    <ChatInlinePanelAppCard
      panelApp={{
        appId: display.target.payload.appId,
        title: display.title,
      }}
    />
  );
}

const renderChatToolAgent = (agentId: string) => <AgentIdentityAvatar agentId={agentId} className="h-4 w-4 shrink-0" />;
const renderChatPanelAppCard = (panelApp: ChatPanelAppCardViewModel) => <ChatInlinePanelAppCard panelApp={panelApp} />;

type ContextInheritanceTimelineView = {
  sourceSessionId: string;
  inheritedMessageCount: number;
};

type ContextInheritanceTimelineBoundary = ContextInheritanceTimelineView & {
  boundaryIndex: number;
};

type ChatTimelineItem =
  | {
      kind: "messages";
      key: string;
      messages: ChatMessageViewModel[];
    }
  | {
      kind: "compaction";
      key: string;
      checkpoint: ContextCompactionTimelineView;
    }
  | {
      kind: "context-inheritance";
      key: string;
      inheritance: ContextInheritanceTimelineView;
    };

function ChatContextCompactionDivider({ checkpoint }: { checkpoint: ContextCompactionTimelineView }) {
  const title = [
    `${t("chatContextCompactionCoveredMessages")}: ${checkpoint.coveredSessionMessageCount}`,
    `${t("chatContextCompactionOriginalTokens")}: ${checkpoint.originalEstimatedTokens}`,
    `${t("chatContextCompactionProjectedTokens")}: ${checkpoint.projectedEstimatedTokens}`,
  ].join("\n");
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground" title={title}>
      <div className="h-px flex-1 bg-border" />
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1">
        {checkpoint.status === "compressing" ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />
        )}
        <span>
          {checkpoint.status === "compressing"
            ? t("chatContextCompactionCompressing")
            : t("chatContextCompactionCompressed")}
        </span>
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ChatContextInheritanceDivider({ inheritance }: { inheritance: ContextInheritanceTimelineView }) {
  const title = [
    `${t("chatContextInheritanceSourceSession")}: ${inheritance.sourceSessionId}`,
    `${t("chatContextInheritanceMessages")}: ${inheritance.inheritedMessageCount}`,
  ].join("\n");
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] text-emerald-700" title={title}>
      <div className="h-px flex-1 bg-emerald-100" />
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>{t("chatContextInheritanceInherited")}</span>
      </div>
      <div className="h-px flex-1 bg-emerald-100" />
    </div>
  );
}

function resolveCompactionBoundaryIndex(params: {
  rawMessages: readonly NcpMessage[];
  visibleRawMessages: readonly NcpMessage[];
  rawMessageId: string;
}): number {
  const { rawMessageId, rawMessages, visibleRawMessages } = params;
  const physicalIndex = rawMessages.findIndex((message) => message.id === rawMessageId);
  if (physicalIndex < 0) {
    return visibleRawMessages.length - 1;
  }
  const previousVisibleCount = rawMessages.slice(0, physicalIndex).filter(isVisibleChatMessage).length;
  return previousVisibleCount - 1;
}

function readInheritedSourceSessionId(message: NcpMessage): string | null {
  const value = message.metadata?.[INHERITED_FROM_SESSION_METADATA_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isVisibleChatMessage(message: NcpMessage): boolean {
  return !readContextCompactionTimeline(message) && !readInheritedSourceSessionId(message);
}

function resolveContextInheritanceBoundary(messages: readonly NcpMessage[]): ContextInheritanceTimelineBoundary | null {
  const boundaryIndex = messages.findIndex((message) => readInheritedSourceSessionId(message));
  if (boundaryIndex < 0) {
    return null;
  }
  const sourceSessionId = readInheritedSourceSessionId(messages[boundaryIndex]);
  if (!sourceSessionId) {
    return null;
  }
  return {
    boundaryIndex: messages.slice(0, boundaryIndex).filter(isVisibleChatMessage).length,
    sourceSessionId,
    inheritedMessageCount: messages.filter((message) => readInheritedSourceSessionId(message) === sourceSessionId)
      .length,
  };
}

function buildTimelineItems(params: {
  rawMessages: readonly NcpMessage[];
  messages: ChatMessageViewModel[];
}): ChatTimelineItem[] {
  const visibleRawMessages = params.rawMessages.filter(isVisibleChatMessage);
  const checkpoints = params.rawMessages
    .map((message) => ({
      rawMessageId: message.id,
      checkpoint: readContextCompactionTimeline(message),
    }))
    .filter(
      (
        entry,
      ): entry is {
        rawMessageId: string;
        checkpoint: ContextCompactionTimelineView;
      } => Boolean(entry.checkpoint),
    )
    .map((entry) => ({
      key: entry.rawMessageId,
      checkpoint: entry.checkpoint,
      boundaryIndex: resolveCompactionBoundaryIndex({
        rawMessages: params.rawMessages,
        visibleRawMessages,
        rawMessageId: entry.rawMessageId,
      }),
    }))
    .sort((left, right) => left.boundaryIndex - right.boundaryIndex);
  const contextInheritance = resolveContextInheritanceBoundary(params.rawMessages);

  const items: ChatTimelineItem[] = [];
  let pendingMessages: ChatMessageViewModel[] = [];
  let checkpointCursor = 0;
  const flushPendingMessages = (key: string) => {
    if (pendingMessages.length === 0) {
      return;
    }
    items.push({
      kind: "messages",
      key,
      messages: pendingMessages,
    });
    pendingMessages = [];
  };

  visibleRawMessages.forEach((rawMessage, index) => {
    if (contextInheritance?.boundaryIndex === index) {
      flushPendingMessages("messages-before-context-inheritance");
      items.push({
        kind: "context-inheritance",
        key: "context-inheritance",
        inheritance: contextInheritance,
      });
    }
    const message = params.messages[index];
    if (message) {
      pendingMessages.push(message);
    }
    while (checkpointCursor < checkpoints.length && checkpoints[checkpointCursor]?.boundaryIndex <= index) {
      const currentCheckpoint = checkpoints[checkpointCursor];
      flushPendingMessages(`messages-before-${currentCheckpoint.key}`);
      items.push({
        kind: "compaction",
        key: currentCheckpoint.key,
        checkpoint: currentCheckpoint.checkpoint,
      });
      checkpointCursor += 1;
    }
  });
  if (contextInheritance?.boundaryIndex === visibleRawMessages.length) {
    flushPendingMessages("messages-before-context-inheritance");
    items.push({
      kind: "context-inheritance",
      key: "context-inheritance",
      inheritance: contextInheritance,
    });
  }
  while (checkpointCursor < checkpoints.length) {
    const currentCheckpoint = checkpoints[checkpointCursor];
    flushPendingMessages(`messages-before-${currentCheckpoint.key}`);
    items.push({
      kind: "compaction",
      key: currentCheckpoint.key,
      checkpoint: currentCheckpoint.checkpoint,
    });
    checkpointCursor += 1;
  }
  flushPendingMessages("messages-final");
  if (items.length === 0) {
    items.push({
      kind: "messages",
      key: "messages-empty",
      messages: [],
    });
  }
  return items;
}

export function ChatMessageListContainer({
  messages: rawMessages,
  isSending,
  sessionKey,
  className,
}: ChatMessageListContainerProps) {
  const presenter = usePresenter();
  const { language } = useI18n();
  const messageLayout = useChatMessageLayoutStore((state) => state.layout);
  const selectedSession = useNcpChatSelectedSession(sessionKey);
  const sessionTypesData = useChatQueryStore(
    (state) => state.snapshot.sessionTypesQuery?.data ?? null,
  );
  const activeSessionType = normalizeSessionType(
    selectedSession?.sessionType ?? sessionTypesData?.defaultType ?? DEFAULT_SESSION_TYPE,
  );
  const sessionTypeOption = buildSessionTypeOptions(
    sessionTypesData?.options ?? [],
  ).find((option) => option.value === activeSessionType);
  const assistantAvatarIcon = sessionTypeOption?.icon?.src?.trim() ? (
    <SessionContextIconNode
      icon={{
        kind: "runtime-image",
        src: sessionTypeOption.icon.src,
        alt: sessionTypeOption.icon.alt ?? null,
        name: sessionTypeOption.label,
      }}
      className="h-[65%] w-[65%]"
    />
  ) : undefined;
  const localFileBasePath = selectedSession?.workingDir ?? selectedSession?.projectRoot ?? null;
  const renderInlineDisplayWithFiles = useCallback(
    (display: ChatInlineDisplayViewModel) => {
      const panelAppDisplay = renderChatInlineDisplay(display);
      if (panelAppDisplay) {
        return panelAppDisplay;
      }
      if (display.target.type === "file") {
        return (
          <ChatInlineFilePreview
            display={display}
            parentSessionKey={sessionKey}
            sessionProjectRoot={selectedSession?.projectRoot ?? null}
            sessionWorkingDir={localFileBasePath}
            onFileOpen={presenter.chatThreadManager.openFilePreview}
          />
        );
      }
      return undefined;
    },
    [localFileBasePath, presenter.chatThreadManager, selectedSession?.projectRoot, sessionKey],
  );
  const resolveFileContentUrl = useCallback(
    (action: { path: string }) => buildServerPathContentUrl(action.path, localFileBasePath),
    [localFileBasePath],
  );
  const texts = useMemo(() => buildChatMessageAdapterTexts(language), [language]);
  const executionLabels = useMemo(() => buildChatMessageExecutionLabels(language), [language]);

  const messages = useMemo(() => {
    const visibleRawMessages = rawMessages.filter(isVisibleChatMessage);
    const processedLabel = t("chatProcessSummaryProcessed");
    return visibleRawMessages.flatMap((message) => {
      const processSummary = buildChatMessageProcessSummary({
        message,
        processedLabel,
      });
      const processSummaryLabel = processSummary?.label ?? null;
      const executionPresentation = buildChatMessageExecutionPresentation({
        message,
        labels: executionLabels,
      });
      const executionPresentationKey = executionPresentation?.cacheKey ?? null;
      const cached = messageViewModelCache.get(message);
      if (
        cached &&
        cached.language === language &&
        cached.processSummaryLabel === processSummaryLabel &&
        cached.executionPresentationKey === executionPresentationKey
      ) {
        return [cached.viewModel];
      }

      const uiMessage = adaptNcpMessageToUiMessage(message);
      const sourceMessage: ChatMessageSource = {
        id: uiMessage.id,
        role: uiMessage.role,
        meta: {
          timestamp: uiMessage.meta?.timestamp,
          status: uiMessage.meta?.status,
          inlineTokens: readInlineTokensFromMetadata(message.metadata),
          processSummary,
          executionSummaryLabel: executionPresentation?.summaryLabel,
          moreActions: executionPresentation?.moreActions,
        },
        parts: uiMessage.parts as unknown as ChatMessageSource["parts"],
      };
      const viewModel = adaptChatMessage(sourceMessage, {
        formatTimestamp: (value) => formatDateTime(value, language),
        texts,
      });

      messageViewModelCache.set(message, {
        language,
        processSummaryLabel,
        executionPresentationKey,
        viewModel,
      });
      return [viewModel];
    });
  }, [executionLabels, language, rawMessages, texts]);

  const hasAssistantDraft = useMemo(
    () =>
      messages.some(
        (message) => message.role === "assistant" && (message.status === "streaming" || message.status === "pending"),
      ),
    [messages],
  );
  const messageTexts = useMemo(() => buildChatMessageTexts(language), [language]);
  const timelineItems = useMemo(() => buildTimelineItems({ rawMessages, messages }), [messages, rawMessages]);
  const sessionSkillsQuery = useChatQueryStore((state) => state.snapshot.sessionSkillsQuery);
  const handleInlineTokenClick = useCallback(
    (token: ChatInlineTokenViewModel) => {
      if (token.kind === "panel_app") {
        void presenter.chatUiManager.showContent({
          target: { type: "panel_app", payload: { appId: token.key } },
        });
        return;
      }
      if (token.kind === "workspace_file" || token.kind === "workspace_directory") {
        const path = resolveWorkspaceReferencePath({
          projectRoot: selectedSession?.projectRoot,
          relativePath: token.key,
        });
        if (path) {
          presenter.chatThreadManager.openFilePreview({
            path,
            label: token.label,
            viewMode: "preview",
          });
        }
        return;
      }
      if (token.kind !== "skill") return;
      const skillKey = token.key.trim();
      if (!skillKey) {
        return;
      }
      const records = sessionSkillsQuery?.data?.records ?? [];
      const matched = records.find((record) => record.ref === skillKey || record.name === skillKey);
      const skillPath = matched?.path?.trim();
      if (!skillPath) {
        return;
      }
      presenter.chatThreadManager.openFilePreview({
        path: skillPath,
        label: token.label || matched?.name || skillKey,
        viewMode: "preview",
        previewViewer: "rendered",
      });
    },
    [presenter.chatThreadManager, presenter.chatUiManager, selectedSession?.projectRoot, sessionSkillsQuery],
  );
  const handleAttachmentOpen = useCallback(
    (file: { label: string; mimeType: string; dataUrl?: string; sizeBytes?: number; isImage: boolean }) => {
      const contentUrl = file.dataUrl?.trim();
      if (!contentUrl) {
        return;
      }
      const label = file.label.trim() || "attachment";
      presenter.chatThreadManager.openFilePreview({
        path: label,
        label,
        viewMode: "preview",
        contentUrl,
        mimeType: file.mimeType,
      });
    },
    [presenter.chatThreadManager],
  );
  return (
    <div className={className}>
      {timelineItems.map((item, index) =>
        item.kind === "compaction" ? (
          <ChatContextCompactionDivider key={item.key} checkpoint={item.checkpoint} />
        ) : item.kind === "context-inheritance" ? (
          <ChatContextInheritanceDivider key={item.key} inheritance={item.inheritance} />
        ) : (
          <ChatMessageList
            assistantAvatarIcon={assistantAvatarIcon}
            key={item.key}
            layout={messageLayout}
            messages={item.messages}
            isSending={index === timelineItems.length - 1 ? isSending : false}
            hasAssistantDraft={hasAssistantDraft}
            texts={messageTexts}
            onToolAction={presenter.chatThreadManager.handleToolAction}
            onFileOpen={presenter.chatThreadManager.openFilePreview}
            onAttachmentOpen={handleAttachmentOpen}
            onInlineTokenClick={handleInlineTokenClick}
            resolveFileContentUrl={resolveFileContentUrl}
            renderInlineDisplay={renderInlineDisplayWithFiles}
            renderToolAgent={renderChatToolAgent}
            renderPanelAppCard={renderChatPanelAppCard}
          />
        ),
      )}
    </div>
  );
}
