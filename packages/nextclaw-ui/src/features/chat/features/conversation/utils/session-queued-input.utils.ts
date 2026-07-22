import {
  createChatComposerTextNode,
  createChatComposerTokenNode,
  normalizeChatComposerNodes,
  type ChatComposerNode,
} from '@nextclaw/agent-chat-ui';
import type { UiNcpSessionQueuedInputView } from '@nextclaw/client-sdk';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';

import {
  readInlineTokensFromMetadata,
  resolveInlineTokensForText,
  type ChatInlineTokenSource,
} from '@/features/chat/features/input/utils/chat-inline-token.utils';
import { deriveChatComposerDraft } from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { normalizeRequestedSkills } from '@/features/chat/features/runtime/utils/chat-runtime.utils';
import type { SessionConversationComposerState } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';

export type SessionQueuedInputComposerSnapshot = SessionConversationComposerState & {
  readonly attachments: readonly NcpDraftAttachment[];
};

function buildTextNodes(
  text: string,
  inlineTokens: readonly ChatInlineTokenSource[],
): ChatComposerNode[] {
  const nodes: ChatComposerNode[] = [];
  let offset = 0;
  while (offset < text.length) {
    const nextToken = inlineTokens
      .flatMap((token) => {
        const index = text.indexOf(token.rawText, offset);
        return index < 0 ? [] : [{ index, token }];
      })
      .sort((left, right) => left.index - right.index || right.token.rawText.length - left.token.rawText.length)[0];
    if (!nextToken) {
      nodes.push(createChatComposerTextNode(text.slice(offset)));
      return nodes;
    }
    if (nextToken.index > offset) {
      nodes.push(createChatComposerTextNode(text.slice(offset, nextToken.index)));
    }
    nodes.push(createChatComposerTokenNode({
      tokenKind: nextToken.token.kind,
      tokenKey: "ref" in nextToken.token ? nextToken.token.ref : nextToken.token.key,
      label: nextToken.token.label,
    }));
    offset = nextToken.index + nextToken.token.rawText.length;
  }
  return nodes;
}

function readInputMetadata(input: UiNcpSessionQueuedInputView): Record<string, unknown> {
  return {
    ...input.metadata,
    ...input.message.metadata,
  };
}

function readRequestedSkills(input: UiNcpSessionQueuedInputView): string[] {
  const raw = readInputMetadata(input).requested_skill_refs;
  return normalizeRequestedSkills(
    Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : undefined,
  );
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
  const nodes: ChatComposerNode[] = [];
  const attachments: NcpDraftAttachment[] = [];
  const metadataTokens = readInlineTokensFromMetadata(readInputMetadata(input));

  input.message.parts.forEach((part, index) => {
    if (part.type === 'text' || part.type === 'rich-text' || part.type === 'reasoning') {
      nodes.push(...buildTextNodes(
        part.text,
        resolveInlineTokensForText(part.text, metadataTokens),
      ));
      return;
    }
    if (part.type !== 'file') {
      return;
    }
    const id = `queued-attachment-${input.id}-${index}`;
    const attachment: NcpDraftAttachment = {
      id,
      name: part.name ?? 'attachment',
      mimeType: part.mimeType ?? 'application/octet-stream',
      sizeBytes: part.sizeBytes ?? 0,
      assetUri: part.assetUri,
      url: part.url,
      contentBase64: part.contentBase64,
    };
    attachments.push(attachment);
    nodes.push(createChatComposerTokenNode({
      tokenKind: 'file',
      tokenKey: id,
      label: attachment.name,
    }));
  });

  const normalizedNodes = normalizeChatComposerNodes(nodes);
  const selectedSkills = readRequestedSkills(input);
  const skillNameByRef = new Map(availableSkills.map(({ ref, name }) => [ref, name]));
  return {
    text: deriveChatComposerDraft(normalizedNodes),
    nodes: normalizedNodes,
    selectedSkills,
    skillRecords: selectedSkills.map((ref) => ({
      ref,
      name: skillNameByRef.get(ref) ?? ref,
    })),
    attachments,
  };
}
