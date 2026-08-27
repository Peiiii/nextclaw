import { AgentAvatar } from "@/shared/components/common/agent-avatar";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import { SessionRunBadge } from "@/features/chat/features/session/components/session-run-badge";
import { ChatSessionMoreActionsMenu } from "@/features/chat/features/session/components/session-header/chat-session-more-actions-menu";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { Input } from "@/shared/components/ui/input";
import { type SessionContextView } from "@/features/chat/features/session/utils/session-context.utils";
import type { SessionRunStatus } from "@/features/chat/types/session-run-status.types";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import {
  AlarmClock,
  Check,
  Folder,
  GitBranch,
  Pencil,
  Pin,
  Trash2,
  X,
} from "lucide-react";
import { ChatSidebarContextCard } from "@/features/chat/features/session/components/chat-sidebar-context-card";
import { ChatSessionHeaderMenuItem } from "@/features/chat/features/session/components/session-header/chat-session-header-menu-item";

type ChatSidebarSessionItemProps = {
  sessionKey: string;
  active: boolean;
  showUnreadDot: boolean;
  runStatus?: SessionRunStatus;
  context: SessionContextView;
  isPinned: boolean;
  title: string;
  previewText: string;
  trailingText: string;
  agentId?: string | null;
  agentLabel?: string | null;
  agentAvatarUrl?: string | null;
  childSessionCount?: number;
  cronJobCount?: number;
  projectName?: string | null;
  isEditing: boolean;
  draftLabel: string;
  isSaving: boolean;
  onSelect: () => void;
  onStartEditing: () => void;
  onDraftLabelChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  onTogglePinned: () => void;
  onDelete: () => void;
};

type ChatSidebarSessionEditingViewProps = Pick<
  ChatSidebarSessionItemProps,
  | "sessionKey"
  | "draftLabel"
  | "isSaving"
  | "onDraftLabelChange"
  | "onSave"
  | "onCancel"
>;

function ChatSidebarSessionEditingView({
  sessionKey,
  draftLabel,
  isSaving,
  onDraftLabelChange,
  onSave,
  onCancel,
}: ChatSidebarSessionEditingViewProps) {
  return (
    <div className="space-y-2">
      <Input
        value={draftLabel}
        onChange={(event) => onDraftLabelChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void onSave();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        placeholder={t("sessionsLabelPlaceholder")}
        className="h-8 rounded-lg border-border bg-background text-xs"
        autoFocus
        disabled={isSaving}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] text-muted-foreground/65">
          {sessionKey}
        </div>
        <div className="flex items-center gap-1">
          <IconActionButton
            icon={<Check className="h-3.5 w-3.5" />}
            label={t("save")}
            tooltip={false}
            onClick={() => void onSave()}
            disabled={isSaving}
          />
          <IconActionButton
            icon={<X className="h-3.5 w-3.5" />}
            label={t("cancel")}
            tooltip={false}
            onClick={onCancel}
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

type ChatSidebarSessionDisplayViewProps = Omit<
  ChatSidebarSessionItemProps,
  | "sessionKey"
  | "isEditing"
  | "draftLabel"
  | "isSaving"
  | "onDraftLabelChange"
  | "onSave"
  | "onCancel"
> &
  Pick<ChatSidebarSessionItemProps, "sessionKey">;

function ChatSidebarSessionDisplayView({
  sessionKey,
  active,
  showUnreadDot,
  runStatus,
  context,
  isPinned,
  title,
  previewText,
  trailingText,
  agentId,
  agentLabel,
  agentAvatarUrl,
  childSessionCount = 0,
  cronJobCount = 0,
  projectName,
  onSelect,
  onStartEditing,
  onTogglePinned,
  onDelete,
}: ChatSidebarSessionDisplayViewProps) {
  return (
    <div className="group/session relative">
      <ChatSidebarContextCard
        title={title}
        metrics={[
          {
            icon: <Folder className="h-3.5 w-3.5" />,
            label: t("chatSidebarContextProject"),
            value: projectName,
          },
          {
            icon: <GitBranch className="h-3.5 w-3.5" />,
            label: t("chatSidebarContextChildSessions"),
            value: childSessionCount,
          },
          {
            icon: <AlarmClock className="h-3.5 w-3.5" />,
            label: t("chatSidebarContextScheduledTasks"),
            value: cronJobCount,
          },
        ]}
      >
        <button type="button" onClick={onSelect} className="w-full text-left">
          <div
            className={cn(
              "flex min-h-6 min-w-0 items-center",
              runStatus && "pr-6",
              "group-hover/session:pr-20 group-has-[[data-session-actions]:focus-within]/session:pr-20",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {agentId?.trim() && agentId.trim().toLowerCase() !== "main" ? (
                <AgentAvatar
                  agentId={agentId}
                  displayName={agentLabel}
                  avatarUrl={agentAvatarUrl}
                  className="h-5 w-5 shrink-0"
                />
              ) : null}
              <span className="truncate leading-6 font-medium">{title}</span>
              {context.label ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    active
                      ? "border-border/70 bg-background/80 text-foreground/75"
                      : "border-transparent bg-muted/70 text-muted-foreground",
                  )}
                >
                  {context.label}
                </span>
              ) : null}
              {context.icon ? (
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                  <SessionContextIconNode
                    icon={context.icon}
                    className={cn(
                      "h-[13px] w-[13px]",
                      active ? "text-foreground/75" : "text-muted-foreground",
                    )}
                  />
                </span>
              ) : null}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/65">
            <span className="min-w-0 truncate">{previewText}</span>
            {showUnreadDot ? (
              <span
                aria-label={t("chatSessionUnread")}
                className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary"
              />
            ) : (
              <span className="ml-auto shrink-0">{trailingText}</span>
            )}
          </div>
        </button>
      </ChatSidebarContextCard>
      {runStatus ? (
        <span className="absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center transition-opacity group-hover/session:opacity-0">
          <SessionRunBadge status={runStatus} />
        </span>
      ) : null}
      <div
        data-session-actions
        className="pointer-events-none absolute right-0 top-0 flex h-6 items-center gap-0.5 opacity-0 transition-opacity group-hover/session:pointer-events-auto group-hover/session:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
      >
        <IconActionButton
          size="sm"
          tone="strong"
          icon={
            <Pin
              className={cn(
                "h-3.5 w-3.5",
                isPinned && "fill-current text-foreground",
              )}
            />
          }
          label={t(
            isPinned ? "chatSidebarUnpinSession" : "chatSidebarPinSession",
          )}
          tooltipSide="right"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePinned();
          }}
        />
        <IconActionButton
          size="sm"
          tone="strong"
          icon={<Pencil className="h-3.5 w-3.5" />}
          label={t("edit")}
          tooltipSide="right"
          onClick={(event) => {
            event.stopPropagation();
            onStartEditing();
          }}
        />
        <ChatSessionMoreActionsMenu
          sessionKey={sessionKey}
          triggerSize="sm"
          triggerTone="strong"
        >
          <ChatSessionHeaderMenuItem
            icon={Trash2}
            label={t("chatDeleteSession")}
            onClick={onDelete}
            destructive
          />
        </ChatSessionMoreActionsMenu>
      </div>
    </div>
  );
}

export function ChatSidebarSessionItem({
  sessionKey,
  active,
  showUnreadDot,
  runStatus,
  context,
  isPinned,
  title,
  previewText,
  trailingText,
  agentId,
  agentLabel,
  agentAvatarUrl,
  childSessionCount,
  cronJobCount,
  projectName,
  isEditing,
  draftLabel,
  isSaving,
  onSelect,
  onStartEditing,
  onDraftLabelChange,
  onSave,
  onCancel,
  onTogglePinned,
  onDelete,
}: ChatSidebarSessionItemProps) {
  return (
    <div
      className={cn(
        "w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
        active
          ? "bg-background/90 font-medium text-foreground"
          : "text-foreground/80 hover:bg-background/65 hover:text-foreground",
      )}
    >
      {isEditing ? (
        <ChatSidebarSessionEditingView
          sessionKey={sessionKey}
          draftLabel={draftLabel}
          isSaving={isSaving}
          onDraftLabelChange={onDraftLabelChange}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <ChatSidebarSessionDisplayView
          sessionKey={sessionKey}
          active={active}
          showUnreadDot={showUnreadDot}
          runStatus={runStatus}
          context={context}
          isPinned={isPinned}
          title={title}
          previewText={previewText}
          trailingText={trailingText}
          agentId={agentId}
          agentLabel={agentLabel}
          agentAvatarUrl={agentAvatarUrl}
          onSelect={onSelect}
          childSessionCount={childSessionCount}
          cronJobCount={cronJobCount}
          projectName={projectName}
          onStartEditing={onStartEditing}
          onTogglePinned={onTogglePinned}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
