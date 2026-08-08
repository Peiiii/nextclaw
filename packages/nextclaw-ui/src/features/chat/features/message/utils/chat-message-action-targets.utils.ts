import type { NcpMessage } from '@nextclaw/ncp';

import { projectVisibleChatMessages } from '@/features/chat/features/message/utils/chat-message-timeline.utils';

export type ChatMessageActionTargets = {
  readonly continuationAssistantMessageId: string | null;
  readonly editableUserMessageId: string | null;
};

export function resolveChatMessageActionTargets(params: {
  readonly canContinue: boolean;
  readonly isBusy: boolean;
  readonly messages: readonly NcpMessage[];
}): ChatMessageActionTargets {
  const visibleMessages = projectVisibleChatMessages(params.messages);
  const editableUserMessage = visibleMessages.findLast(
    (message) => message.role === 'user',
  );
  const lastVisibleMessage = visibleMessages.at(-1);
  return {
    continuationAssistantMessageId:
      params.canContinue && lastVisibleMessage?.role === 'assistant'
        ? lastVisibleMessage.id
        : null,
    editableUserMessageId:
      params.isBusy ? null : editableUserMessage?.id ?? null,
  };
}
