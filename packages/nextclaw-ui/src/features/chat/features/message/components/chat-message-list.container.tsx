import {
  useCallback,
  useMemo,
  useState,
  type FocusEvent,
  type RefObject,
} from "react";
import type { NcpMessage } from "@nextclaw/ncp";
import { toast } from "sonner";
import {
  type ChatInlineDisplayViewModel,
  type ChatInlineTokenViewModel,
  type ChatMessageViewModel,
  type ChatPanelAppCardViewModel,
  ChatMessageList,
} from "@nextclaw/agent-chat-ui";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import {
  adaptChatMessage,
  type ChatMessageSource,
} from "@/features/chat/features/message/utils/chat-message.utils";
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
import { type ContextCompactionTimelineView } from "@/features/chat/features/session/utils/ncp-session-context-metadata.utils";
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
import { useChatMessageVirtualizer } from "@/features/chat/features/message/hooks/use-chat-message-virtualizer";
import {
  buildChatMessageTimelineItems,
  isVisibleChatMessage,
  type ChatTimelineItem,
  type ContextInheritanceTimelineView,
} from "@/features/chat/features/message/utils/chat-message-timeline.utils";
import { buildServerPathContentUrl, fetchNcpSessionSkills } from "@/shared/lib/api";
import { formatDateTime, t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type ChatMessageListContainerProps = {
  messages: readonly NcpMessage[];
  isSending: boolean;
  sessionKey: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  className?: string;
};

class ChatMessageViewModelAdapter {
  private readonly cache = new WeakMap<
    NcpMessage,
    {
      language: Parameters<typeof formatDateTime>[1];
      processSummaryLabel: string | null;
      executionPresentationKey: string | null;
      viewModel: ChatMessageViewModel;
    }
  >();

  adapt = (params: {
    executionLabels: ReturnType<typeof buildChatMessageExecutionLabels>;
    language: Parameters<typeof formatDateTime>[1];
    processedLabel: string;
    rawMessages: readonly NcpMessage[];
    texts: ReturnType<typeof buildChatMessageAdapterTexts>;
  }): ChatMessageViewModel[] => {
    const { executionLabels, language, processedLabel, rawMessages, texts } =
      params;
    return rawMessages.filter(isVisibleChatMessage).flatMap((message) => {
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
      const cached = this.cache.get(message);
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

      this.cache.set(message, {
        language,
        processSummaryLabel,
        executionPresentationKey,
        viewModel,
      });
      return [viewModel];
    });
  };
}

const chatMessageViewModelAdapter = new ChatMessageViewModelAdapter();

function renderChatInlineDisplay(display: ChatInlineDisplayViewModel) {
  if (display.target.type !== "panel_app") {
    return undefined;
  }
  return (
    <ChatInlinePanelAppCard
      panelApp={{
        appId: display.target.payload.appId,
        path: display.target.payload.path,
        title: display.title,
      }}
    />
  );
}

const renderChatToolAgent = (agentId: string) => (
  <AgentIdentityAvatar agentId={agentId} className="h-4 w-4 shrink-0" />
);
const renderChatPanelAppCard = (panelApp: ChatPanelAppCardViewModel) => (
  <ChatInlinePanelAppCard panelApp={panelApp} />
);

function ChatContextCompactionDivider({
  checkpoint,
}: {
  checkpoint: ContextCompactionTimelineView;
}) {
  const title = [
    `${t("chatContextCompactionCoveredMessages")}: ${checkpoint.coveredSessionMessageCount}`,
    `${t("chatContextCompactionOriginalTokens")}: ${checkpoint.originalEstimatedTokens}`,
    `${t("chatContextCompactionProjectedTokens")}: ${checkpoint.projectedEstimatedTokens}`,
  ].join("\n");
  return (
    <div
      className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground"
      title={title}
    >
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

function ChatContextInheritanceDivider({
  inheritance,
}: {
  inheritance: ContextInheritanceTimelineView;
}) {
  const title = [
    `${t("chatContextInheritanceSourceSession")}: ${inheritance.sourceSessionId}`,
    `${t("chatContextInheritanceMessages")}: ${inheritance.inheritedMessageCount}`,
  ].join("\n");
  return (
    <div
      className="my-4 flex items-center gap-3 text-[11px] text-emerald-700"
      title={title}
    >
      <div className="h-px flex-1 bg-emerald-100" />
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>{t("chatContextInheritanceInherited")}</span>
      </div>
      <div className="h-px flex-1 bg-emerald-100" />
    </div>
  );
}

export function ChatMessageListContainer({
  messages: rawMessages,
  isSending,
  scrollRef,
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
    selectedSession?.sessionType ??
      sessionTypesData?.defaultType ??
      DEFAULT_SESSION_TYPE,
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
  const localFileBasePath =
    selectedSession?.workingDir ?? selectedSession?.projectRoot ?? null;
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
    [
      localFileBasePath,
      presenter.chatThreadManager,
      selectedSession?.projectRoot,
      sessionKey,
    ],
  );
  const resolveFileContentUrl = useCallback(
    (action: { path: string }) =>
      buildServerPathContentUrl(action.path, localFileBasePath),
    [localFileBasePath],
  );
  const texts = useMemo(
    () => buildChatMessageAdapterTexts(language),
    [language],
  );
  const executionLabels = useMemo(
    () => buildChatMessageExecutionLabels(language),
    [language],
  );

  const messages = useMemo(
    () =>
      chatMessageViewModelAdapter.adapt({
        executionLabels,
        language,
        processedLabel: t("chatProcessSummaryProcessed"),
        rawMessages,
        texts,
      }),
    [executionLabels, language, rawMessages, texts],
  );

  const activeAssistantMessage = messages.findLast(
    (message) =>
      message.role === "assistant" &&
      (message.status === "streaming" || message.status === "pending"),
  );
  const hasAssistantDraft = Boolean(activeAssistantMessage);
  const messageTexts = useMemo(
    () => buildChatMessageTexts(language),
    [language],
  );
  const timelineItems = useMemo(
    () => buildChatMessageTimelineItems({ rawMessages, messages }),
    [messages, rawMessages],
  );
  const virtualRows = useMemo<ChatTimelineItem[]>(
    () =>
      isSending && !hasAssistantDraft
        ? [...timelineItems, { kind: "typing", key: "typing" }]
        : timelineItems,
    [hasAssistantDraft, isSending, timelineItems],
  );
  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);
  const activeRowKey = activeAssistantMessage ? `message:${activeAssistantMessage.id}` : null;
  const { containerRef, virtualizer } = useChatMessageVirtualizer({
    rows: virtualRows,
    scrollRef,
    activeRowKey,
    focusedRowKey,
  });
  const handleInlineTokenClick = useCallback(
    (token: ChatInlineTokenViewModel) => {
      if (token.kind === "panel_app" && "key" in token) {
        void presenter.chatUiManager.showContent({
          target: { type: "panel_app", payload: { appId: token.key } },
        });
        return;
      }
      if (
        "key" in token &&
        (token.kind === "workspace_file" ||
          token.kind === "workspace_directory")
      ) {
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
      if (token.kind !== "skill" || !("ref" in token)) return;
      const skillPath = token.path?.trim();
      if (skillPath) {
        presenter.chatThreadManager.openFilePreview({
          path: skillPath,
          label: token.label || token.name,
          viewMode: "preview",
          previewViewer: "rendered",
        });
        return;
      }
      if (!sessionKey) {
        toast.error(t("chatSkillPreviewUnavailable"));
        return;
      }
      void fetchNcpSessionSkills(sessionKey, {
        projectRoot: selectedSession?.projectRoot ?? null,
      }).then(({ records }) => {
        const exact = records.find((record) => record.ref === token.ref);
        const named = records.filter((record) => record.name === token.name);
        const matched = exact ?? (named.length === 1 ? named[0] : null);
        const legacyPath = matched?.path.trim();
        if (!matched || !legacyPath) {
          toast.error(t("chatSkillPreviewUnavailable"));
          return;
        }
        presenter.chatThreadManager.openFilePreview({
          path: legacyPath,
          label: token.label || matched.name,
          viewMode: "preview",
          previewViewer: "rendered",
        });
      }).catch(() => toast.error(t("chatSkillPreviewUnavailable")));
    },
    [
      presenter.chatThreadManager,
      presenter.chatUiManager,
      selectedSession?.projectRoot,
      sessionKey,
    ],
  );
  const handleAttachmentOpen = useCallback(
    (file: {
      label: string;
      mimeType: string;
      dataUrl?: string;
      sizeBytes?: number;
      isImage: boolean;
    }) => {
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
  const handleRowBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusedRowKey(null);
    }
  }, []);
  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = virtualRows[virtualRow.index];
        if (!item) {
          return null;
        }
        return (
          <div
            data-index={virtualRow.index}
            key={item.key}
            ref={virtualizer.measureElement}
            onBlurCapture={handleRowBlur}
            onFocusCapture={() => setFocusedRowKey(item.key)}
            className="absolute left-0 top-0 w-full"
          >
            {item.kind === "compaction" ? (
              <ChatContextCompactionDivider checkpoint={item.checkpoint} />
            ) : item.kind === "context-inheritance" ? (
              <ChatContextInheritanceDivider inheritance={item.inheritance} />
            ) : (
              <div className={item.kind === "message" ? "pb-5" : undefined}>
                <ChatMessageList
                  assistantAvatarIcon={assistantAvatarIcon}
                  layout={messageLayout}
                  messages={item.kind === "message" ? [item.message] : []}
                  isSending={item.kind === "typing"}
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
