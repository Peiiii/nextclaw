import {
  isHiddenNcpMessage,
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { eventKeys } from "@nextclaw/shared";
import type { AppNotificationManager } from "@/features/notifications";
import { buildSessionPath } from "@/features/chat/features/session/utils/chat-session-route.utils";
import { sessionDisplayName } from "@/features/chat/features/session/utils/chat-session-display.utils";
import { adaptNcpSessionSummary } from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { nextclawClient } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";

const NOTIFICATION_PREVIEW_MAX_CHARACTERS = 120;
const NOTIFIED_MESSAGE_HISTORY_LIMIT = 200;

function buildNotificationPreview(value: string): string {
  const normalized = value
    .replace(/\r\n?/gu, "\n")
    .replace(/^[ \t]*\[[^\]]+\]:\s+\S+.*$/gmu, " ")
    .replace(/^[ \t]*(?:`{3,}|~{3,})[^\n]*$/gmu, " ")
    .replace(/^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/gmu, " ")
    .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gmu, " ")
    .replace(/!\[([^\]]*)\]\([^\n)]+\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^\n)]+\)/gu, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/gu, "$1")
    .replace(/<(https?:\/\/[^>\s]+)>/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gmu, "")
    .replace(/^[ \t]*>+[ \t]?/gmu, "")
    .replace(/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/gmu, "")
    .replace(/^[ \t]*\[(?: |x|X)\][ \t]*/gmu, "")
    .replace(/(`+)([^`]*?)\1/gu, "$2")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/gu, "$2")
    .replace(/~~(?=\S)([\s\S]*?\S)~~/gu, "$1")
    .replace(/\*(?=\S)([^*\n]*?\S)\*/gu, "$1")
    .replace(/\\([\\`*{}[\]()#+.!_>-])/gu, "$1")
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gmu, (_match, row: string) =>
      row.split("|").map((cell) => cell.trim()).filter(Boolean).join(" "),
    )
    .replace(/\s+/gu, " ")
    .trim();
  const characters = Array.from(normalized);
  if (characters.length <= NOTIFICATION_PREVIEW_MAX_CHARACTERS) {
    return normalized;
  }
  return `${characters.slice(0, NOTIFICATION_PREVIEW_MAX_CHARACTERS - 1).join("")}…`;
}

function readAssistantReplyPreview(message: NcpMessage): string {
  return buildNotificationPreview(
    message.parts
      .filter((part) => part.type === "text" || part.type === "rich-text")
      .map((part) => part.text)
      .join(" "),
  );
}

export class ChatCompletionNotificationManager {
  private readonly cleanups: Array<() => void> = [];
  private readonly handledMessageIds = new Set<string>();
  private activeSessionId: string | null = null;
  private started = false;

  constructor(
    private readonly notificationManager: Pick<AppNotificationManager, "show">,
  ) {}

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(
      nextclawClient.eventBus.on(eventKeys.ncpEvent, this.handleNcpEvent),
    );
  };

  stop = (): void => {
    if (!this.started) {
      return;
    }
    this.started = false;
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  };

  syncActiveSession = (sessionId: string | null): void => {
    this.activeSessionId = sessionId?.trim() || null;
  };

  private readonly handleNcpEvent = (event: NcpEndpointEvent): void => {
    if (event.type !== NcpEventType.MessageCompleted) {
      return;
    }

    const { message } = event.payload;
    const sessionId = event.payload.sessionId.trim();
    if (
      !sessionId ||
      this.handledMessageIds.has(message.id) ||
      message.role !== "assistant" ||
      message.status !== "final" ||
      isHiddenNcpMessage(message)
    ) {
      return;
    }
    this.rememberHandledMessage(message.id);
    if (sessionId === this.activeSessionId) {
      return;
    }

    const title = this.resolveSessionTitle(sessionId);
    const preview = readAssistantReplyPreview(message);
    this.notificationManager.show({
      id: `chat-reply:${message.id}`,
      title,
      description: preview || t("chatBackgroundReplyFallbackPreview"),
      href: buildSessionPath(sessionId),
      ariaLabel: t("chatBackgroundReplyOpenAriaLabel").replace("{title}", title),
    });
  };

  private readonly resolveSessionTitle = (sessionId: string): string => {
    const summaries =
      useChatQueryStore.getState().snapshot.sessionsQuery?.data?.sessions ?? [];
    const summary = summaries.find((item) => item.sessionId === sessionId);
    return summary
      ? sessionDisplayName(adaptNcpSessionSummary(summary))
      : t("chatBackgroundReplyFallbackTitle");
  };

  private readonly rememberHandledMessage = (messageId: string): void => {
    this.handledMessageIds.add(messageId);
    if (this.handledMessageIds.size <= NOTIFIED_MESSAGE_HISTORY_LIMIT) {
      return;
    }
    const oldestMessageId = this.handledMessageIds.values().next().value;
    if (oldestMessageId) {
      this.handledMessageIds.delete(oldestMessageId);
    }
  };
}
