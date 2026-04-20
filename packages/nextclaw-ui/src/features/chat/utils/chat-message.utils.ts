import { adaptChatMessagePart } from "./chat-message-part.utils";
import type { ChatInlineTokenSource } from "@/features/chat/utils/chat-inline-token.utils";
import type {
  ChatMessageRole,
  ChatMessageViewModel,
} from "@nextclaw/agent-chat-ui";
import type {
  ChatMessageAdapterTexts,
  ChatMessagePartSource,
} from "@/features/chat/types/chat-message.types";

export type {
  ChatMessageAdapterTexts,
  ChatMessagePartSource,
} from "@/features/chat/types/chat-message.types";

export type ChatMessageSource = {
  id: string;
  role: string;
  meta?: {
    timestamp?: string;
    status?: string;
    inlineTokens?: ChatInlineTokenSource[];
  };
  parts: ChatMessagePartSource[];
};

function resolveMessageTimestamp(message: ChatMessageSource): string {
  const candidate = message.meta?.timestamp;
  if (candidate && Number.isFinite(Date.parse(candidate))) {
    return candidate;
  }
  return new Date().toISOString();
}

function resolveRoleLabel(
  role: string,
  texts: ChatMessageAdapterTexts["roleLabels"],
): string {
  if (role === "user") {
    return texts.user;
  }
  if (role === "assistant") {
    return texts.assistant;
  }
  if (role === "tool") {
    return texts.tool;
  }
  if (role === "system") {
    return texts.system;
  }
  return texts.fallback;
}

function resolveUiRole(role: string): ChatMessageRole {
  if (
    role === "user" ||
    role === "assistant" ||
    role === "tool" ||
    role === "system"
  ) {
    return role;
  }
  return "message";
}

type ChatMessageAdapterParams = {
  texts: ChatMessageAdapterTexts;
  formatTimestamp: (value: string) => string;
};

export function adaptChatMessage(
  message: ChatMessageSource,
  params: ChatMessageAdapterParams,
): ChatMessageViewModel {
  return {
    id: message.id,
    role: resolveUiRole(message.role),
    roleLabel: resolveRoleLabel(message.role, params.texts.roleLabels),
    timestampLabel: params.formatTimestamp(resolveMessageTimestamp(message)),
    status: message.meta?.status,
    parts: message.parts
      .map((part) =>
        adaptChatMessagePart({
          part,
          inlineTokens: message.meta?.inlineTokens ?? [],
          texts: params.texts,
        }),
      )
      .filter((part) => part !== null),
  };
}

export function adaptChatMessages(params: {
  uiMessages: ChatMessageSource[];
  texts: ChatMessageAdapterTexts;
  formatTimestamp: (value: string) => string;
}): ChatMessageViewModel[] {
  return params.uiMessages.map((message) => adaptChatMessage(message, params));
}
