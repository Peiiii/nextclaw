import type { UiNcpSessionQueuedInputView } from '@nextclaw/client-sdk';
import type { NcpMessagePart } from '@nextclaw/ncp';

import { buildNcpAssetContentUrl } from '@/shared/lib/api';
import {
  readInlineTokensFromMetadata,
} from '@/features/chat/features/input/utils/chat-inline-token.utils';
import {
  buildSessionMessageComposerSnapshot,
  type SessionMessageComposerSnapshot,
} from '@/features/chat/features/conversation/utils/session-message-composer.utils';

export type SessionQueuedInputComposerSnapshot = SessionMessageComposerSnapshot;

export type SessionQueuedInputAttachmentPreview = {
  readonly mimeType: string;
  readonly name: string;
  readonly previewUrl?: string;
};

export type SessionQueuedInputPresentation = {
  readonly attachments: readonly SessionQueuedInputAttachmentPreview[];
  readonly preview: string;
};

function readInputMetadata(input: UiNcpSessionQueuedInputView): Record<string, unknown> {
  return {
    ...input.metadata,
    ...input.message.metadata,
  };
}

function buildSessionQueuedInputPreview(input: UiNcpSessionQueuedInputView): string {
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
  return plainText;
}

function buildImagePreviewUrl(
  part: Extract<NcpMessagePart, { type: 'file' }>,
): string | undefined {
  if (!part.mimeType?.startsWith('image/')) return undefined;
  const url = part.url?.trim();
  if (url) return url;
  const contentBase64 = part.contentBase64?.trim();
  if (contentBase64) return `data:${part.mimeType};base64,${contentBase64}`;
  const assetUri = part.assetUri?.trim();
  return assetUri ? buildNcpAssetContentUrl(assetUri) : undefined;
}

export function buildSessionQueuedInputPresentation(
  input: UiNcpSessionQueuedInputView,
): SessionQueuedInputPresentation {
  const attachments = input.message.parts.flatMap((part, index) => {
    if (part.type !== 'file') return [];
    const mimeType = part.mimeType ?? 'application/octet-stream';
    const previewUrl = buildImagePreviewUrl(part);
    return [{
      mimeType,
      name: part.name?.trim() || `attachment-${index + 1}`,
      ...(previewUrl ? { previewUrl } : {}),
    }];
  });
  return {
    attachments,
    preview: buildSessionQueuedInputPreview(input),
  };
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
