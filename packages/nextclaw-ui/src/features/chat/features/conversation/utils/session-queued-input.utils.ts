import type { UiNcpSessionQueuedInputView } from '@nextclaw/client-sdk';

import {
  readInlineTokensFromMetadata,
} from '@/features/chat/features/input/utils/chat-inline-token.utils';
import {
  buildSessionMessageComposerSnapshot,
  type SessionMessageComposerSnapshot,
} from '@/features/chat/features/conversation/utils/session-message-composer.utils';

export type SessionQueuedInputComposerSnapshot = SessionMessageComposerSnapshot;

function readInputMetadata(input: UiNcpSessionQueuedInputView): Record<string, unknown> {
  return {
    ...input.metadata,
    ...input.message.metadata,
  };
}

export function buildSessionQueuedInputPreview(input: UiNcpSessionQueuedInputView): string {
  const inlineTokens = readInlineTokensFromMetadata(readInputMetadata(input));
  const text = input.message.parts.flatMap((part) =>
    part.type === 'text' || part.type === 'rich-text' || part.type === 'reasoning'
      ? [part.text]
      : [],
  ).join(' ');
  const plainText = inlineTokens.reduce(
    (value, token) => value.split(token.rawText).join(''),
    text,
  ).replace(/\s+/g, ' ').trim();
  if (plainText) {
    return plainText;
  }
  return input.message.parts.flatMap((part) => part.type === 'file' && part.name ? [part.name] : []).join(', ');
}

export function buildSessionQueuedInputComposerSnapshot(
  input: UiNcpSessionQueuedInputView,
  availableSkills: readonly { ref: string; name: string }[],
): SessionQueuedInputComposerSnapshot {
  return buildSessionMessageComposerSnapshot({
    attachmentIdPrefix: `queued-attachment-${input.id}`,
    availableSkills,
    message: input.message,
    metadata: readInputMetadata(input),
  });
}
