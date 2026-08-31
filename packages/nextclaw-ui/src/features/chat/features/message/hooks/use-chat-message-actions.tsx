import { useCallback, useMemo, useState } from 'react';
import type { NcpMessage } from '@nextclaw/ncp';
import type {
  ChatMessageActionViewModel,
  ChatMessageViewModel,
} from '@nextclaw/agent-chat-ui';

import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  readInlineTokensFromMetadata,
} from '@/features/chat/features/input/utils/chat-inline-token.utils';
import { deriveNcpMessagePartsFromComposer } from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { buildChatRunMetadata } from '@/features/chat/features/session/utils/chat-run-metadata.utils';
import { ChatMessageInlineEditor } from '@/features/chat/features/message/components/chat-message-inline-editor';
import { resolveChatMessageActionTargets } from '@/features/chat/features/message/utils/chat-message-action-targets.utils';
import {
  buildSessionMessageComposerSnapshot,
  type SessionMessageComposerSnapshot,
} from '@/features/chat/features/conversation/utils/session-message-composer.utils';
import { t } from '@/shared/lib/i18n';

type EditingMessageState = {
  readonly message: NcpMessage;
  readonly snapshot: SessionMessageComposerSnapshot;
};

function createEditedMessageId(): string {
  return `edited-message-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function hasSendableParts(parts: NcpMessage['parts']): boolean {
  return parts.some((part) =>
    part.type === 'text' || part.type === 'rich-text' || part.type === 'reasoning'
      ? part.text.trim().length > 0
      : true,
  );
}

function buildEditedMessageMetadata(
  message: NcpMessage,
  snapshot: SessionMessageComposerSnapshot,
): Record<string, unknown> | undefined {
  const metadata = { ...message.metadata };
  delete metadata[CHAT_INLINE_TOKENS_METADATA_KEY];
  const skillRecords = readInlineTokensFromMetadata(message.metadata).flatMap(
    (token) =>
      token.kind === 'skill' &&
      'ref' in token &&
      token.source &&
      token.path
        ? [{
            name: token.name,
            path: token.path,
            ref: token.ref,
            source: token.source,
          }]
        : [],
  );
  Object.assign(metadata, buildChatRunMetadata({
    composerNodes: [...snapshot.nodes],
    skillRecords,
  }));
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function useChatMessageActions({
  adaptedMessages,
  canContinue,
  disabled,
  onContinueRun,
  onEditMessage,
  rawMessages,
}: {
  readonly adaptedMessages: readonly ChatMessageViewModel[];
  readonly canContinue: boolean;
  readonly disabled: boolean;
  readonly onContinueRun?: () => Promise<void> | void;
  readonly onEditMessage?: (payload: {
    readonly message: NcpMessage;
    readonly messageId: string;
  }) => Promise<void> | void;
  readonly rawMessages: readonly NcpMessage[];
}) {
  const actionTargets = useMemo(
    () => resolveChatMessageActionTargets({
      canContinue,
      isBusy: disabled,
      messages: rawMessages,
    }),
    [canContinue, disabled, rawMessages],
  );
  const messages = useMemo(
    () => adaptedMessages.map((message) => {
      const actions: ChatMessageActionViewModel[] = [];
      if (onEditMessage && message.id === actionTargets.editableUserMessageId) {
        actions.push({
          disabled,
          icon: 'edit',
          key: 'edit-message',
          label: t('chatEditMessage'),
        });
      }
      if (
        onContinueRun &&
        message.id === actionTargets.continuationAssistantMessageId
      ) {
        actions.push({
          disabled,
          icon: 'continue',
          key: 'continue-run',
          label: t('chatContinueRun'),
        });
      }
      return actions.length > 0 ? { ...message, actions } : message;
    }),
    [actionTargets, adaptedMessages, disabled, onContinueRun, onEditMessage],
  );
  const [editingMessage, setEditingMessage] = useState<EditingMessageState | null>(null);
  const handleMessageAction = useCallback((
    message: ChatMessageViewModel,
    action: ChatMessageActionViewModel,
  ) => {
    if (action.key === 'continue-run') {
      void Promise.resolve(onContinueRun?.()).catch(() => undefined);
      return;
    }
    if (action.key !== 'edit-message' || !onEditMessage) {
      return;
    }
    const sourceMessage = rawMessages.find((item) => item.id === message.id);
    if (!sourceMessage) {
      return;
    }
    setEditingMessage({
      message: sourceMessage,
      snapshot: buildSessionMessageComposerSnapshot({
        attachmentIdPrefix: `edited-attachment-${sourceMessage.id}`,
        availableSkills: [],
        message: sourceMessage,
      }),
    });
  }, [onContinueRun, onEditMessage, rawMessages]);
  const saveEditedMessage = useCallback(async () => {
    if (!editingMessage || !onEditMessage) {
      return;
    }
    const parts = deriveNcpMessagePartsFromComposer(
      [...editingMessage.snapshot.nodes],
      editingMessage.snapshot.attachments,
    );
    if (!hasSendableParts(parts)) {
      return;
    }
    await onEditMessage({
      messageId: editingMessage.message.id,
      message: {
        ...editingMessage.message,
        id: createEditedMessageId(),
        metadata: buildEditedMessageMetadata(
          editingMessage.message,
          editingMessage.snapshot,
        ),
        parts,
        role: 'user',
        status: 'final',
        timestamp: new Date().toISOString(),
      },
    });
    setEditingMessage(null);
  }, [editingMessage, onEditMessage]);
  const renderMessageContent = useCallback(
    (message: ChatMessageViewModel) =>
      editingMessage?.message.id === message.id ? (
        <ChatMessageInlineEditor
          disabled={disabled}
          messageId={editingMessage.message.id}
          onCancel={() => setEditingMessage(null)}
          onChange={(snapshot) => setEditingMessage((current) =>
            current ? { ...current, snapshot } : null
          )}
          onSave={saveEditedMessage}
          snapshot={editingMessage.snapshot}
        />
      ) : undefined,
    [disabled, editingMessage, saveEditedMessage],
  );

  return { handleMessageAction, messages, renderMessageContent };
}
