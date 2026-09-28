import { adaptChatMessagePart } from "./chat-message-part.utils";
import type { NcpMessage } from "@nextclaw/ncp";
import type { ChatInlineTokenSource } from "@/features/chat/features/input/utils/chat-inline-token.utils";
import type {
  ChatMessageMoreActionsViewModel,
  ChatMessageRole,
  ChatMessageViewModel,
} from "@nextclaw/agent-chat-ui";
import type {
  ChatMessageAdapterTexts,
  ChatMessagePartSource,
  ChatMessageProcessSummarySource,
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
    processSummary?: ChatMessageProcessSummarySource;
    executionSummaryLabel?: string;
    moreActions?: ChatMessageMoreActionsViewModel;
    userQuestionReply?: ChatUserQuestionReply;
  };
  parts: ChatMessagePartSource[];
};

export type ChatUserQuestionReply = {
  questionId: string;
  questionMessageId: string | null;
  title: string;
  action: "answered" | "dismissed";
  answer: string | null;
};

export function readChatUserQuestionReply(message: NcpMessage): ChatUserQuestionReply | null {
  if (message.role !== "user") return null;
  const { metadata } = message;
  const questionId = metadata?.nextclaw_user_question_id;
  const action = metadata?.nextclaw_user_question_action;
  if (typeof questionId !== "string" || (action !== "answered" && action !== "dismissed")) return null;
  const text = message.parts.find((part) => part.type === "text");
  const legacy = text?.type === "text" ? /^↳ ([^\n]+)\n([\s\S]*)$/.exec(text.text) : null;
  const title = typeof metadata?.nextclaw_user_question_title === "string"
    ? metadata.nextclaw_user_question_title
    : legacy?.[1];
  if (!title?.trim()) return null;
  const answer = typeof metadata?.nextclaw_user_question_answer === "string"
    ? metadata.nextclaw_user_question_answer
    : legacy?.[2] ?? null;
  if (action === "answered" && !answer?.trim()) return null;
  return {
    questionId,
    questionMessageId: typeof metadata?.nextclaw_user_question_message_id === "string"
      ? metadata.nextclaw_user_question_message_id
      : null,
    title,
    action,
    answer: action === "answered" ? answer : null,
  };
}

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
  const parts = message.parts
    .map((part) => adaptChatMessagePart({
      part,
      inlineTokens: message.meta?.inlineTokens ?? [],
      texts: params.texts,
    }))
    .filter((part) => part !== null);
  const hasQuestionPart = parts.some(
    (part) => part.type === "custom" && part.customType === "nextclaw.user-question",
  );
  const reply = message.meta?.userQuestionReply;
  const displayParts: ChatMessageViewModel["parts"] = reply
    ? [
        { type: "custom", id: reply.questionId, customType: "nextclaw.user-question-reply", data: reply },
        ...(reply.answer ? [{ type: "markdown" as const, text: reply.answer }] : []),
      ]
    : hasQuestionPart ? parts.filter((part) => part.type !== "markdown") : parts;
  return {
    id: message.id,
    role: resolveUiRole(message.role),
    roleLabel: resolveRoleLabel(message.role, params.texts.roleLabels),
    timestampLabel: params.formatTimestamp(resolveMessageTimestamp(message)),
    status: message.meta?.status,
    processSummary: message.meta?.processSummary,
    executionSummaryLabel: message.meta?.executionSummaryLabel,
    moreActions: message.meta?.moreActions,
    parts: displayParts,
  };
}

export function adaptChatMessages(params: {
  uiMessages: ChatMessageSource[];
  texts: ChatMessageAdapterTexts;
  formatTimestamp: (value: string) => string;
}): ChatMessageViewModel[] {
  return params.uiMessages.map((message) => adaptChatMessage(message, params));
}
