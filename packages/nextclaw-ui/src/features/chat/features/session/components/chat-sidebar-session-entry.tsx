import type { SessionEntryView } from "@/shared/lib/api";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import { ChatSidebarSessionItem } from "@/features/chat/features/session/components/chat-sidebar-session-item";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";
import { shouldShowUnreadSessionIndicator } from "@/features/chat/stores/chat-session-list.store";
import {
  formatSessionListTime,
  sessionActivityPreviewText,
} from "@/features/chat/features/session/utils/chat-session-display.utils";
import { resolveSessionContextView } from "@/features/chat/features/session/utils/session-context.utils";

export function ChatSidebarSessionEntry(props: {
  item: NcpSessionListItemView;
  selectedSessionKey: string | null;
  optimisticReadAtBySessionKey: Record<string, string>;
  agentsById: Map<string, { displayName?: string | null; avatarUrl?: string | null }>;
  childSessionsByParentKey: Map<string, NcpSessionListItemView[]>;
  editingSessionKey: string | null;
  draftLabel: string;
  savingSessionKey: string | null;
  sessionTitle: (session: SessionEntryView) => string;
  onSelectSession: (sessionKey: string) => void;
  onOpenChildSessions: (parentSessionKey: string, activeChildSessionKey: string | null) => void;
  onStartEditingSessionLabel: (session: SessionEntryView) => void;
  onDraftLabelChange: (value: string) => void;
  onSaveSessionLabel: (session: SessionEntryView) => void;
  onCancelEditingSessionLabel: () => void;
}) {
  const {
    item,
    selectedSessionKey,
    optimisticReadAtBySessionKey,
    agentsById,
    childSessionsByParentKey,
    editingSessionKey,
    draftLabel,
    savingSessionKey,
    sessionTitle,
    onSelectSession,
    onOpenChildSessions,
    onStartEditingSessionLabel,
    onDraftLabelChange,
    onSaveSessionLabel,
    onCancelEditingSessionLabel,
  } = props;
  const { session, runStatus } = item;
  const inputSnapshot = useChatInputStore((state) => state.snapshot);
  const active = selectedSessionKey === session.key;
  const optimisticReadAt = optimisticReadAtBySessionKey[session.key];
  const effectiveReadAt =
    optimisticReadAt && session.readAt
      ? (optimisticReadAt.localeCompare(session.readAt) > 0 ? optimisticReadAt : session.readAt)
      : optimisticReadAt ?? session.readAt;
  const childSessions = childSessionsByParentKey.get(session.key) ?? [];
  const agentLabel = session.agentId
    ? (agentsById.get(session.agentId)?.displayName ?? session.agentId)
    : null;
  const previewText =
    sessionActivityPreviewText(session) ??
    `${agentLabel?.trim() ? `${agentLabel} · ` : ''}${session.messageCount}`;

  return (
    <ChatSidebarSessionItem
      sessionKey={session.key}
      active={active}
      showUnreadDot={shouldShowUnreadSessionIndicator({
        active,
        lastMessageAt: session.lastMessageAt,
        readAt: effectiveReadAt,
        runStatus,
      })}
      runStatus={runStatus}
      context={resolveSessionContextView(session, inputSnapshot.sessionTypeOptions)}
      title={sessionTitle(session)}
      previewText={previewText}
      trailingText={formatSessionListTime(session.lastMessageAt ?? session.createdAt)}
      agentId={session.agentId ?? null}
      agentLabel={agentLabel}
      agentAvatarUrl={session.agentId ? (agentsById.get(session.agentId)?.avatarUrl ?? null) : null}
      childSessionCount={childSessions.length}
      isEditing={editingSessionKey === session.key}
      draftLabel={draftLabel}
      isSaving={savingSessionKey === session.key}
      onSelect={() => onSelectSession(session.key)}
      onOpenChildSessions={() =>
        onOpenChildSessions(session.key, childSessions[0]?.session.key ?? null)
      }
      onStartEditing={() => onStartEditingSessionLabel(session)}
      onDraftLabelChange={onDraftLabelChange}
      onSave={() => onSaveSessionLabel(session)}
      onCancel={onCancelEditingSessionLabel}
    />
  );
}
