import {
  createChatComposerTextNode,
  createChatComposerTokenNode,
  normalizeChatComposerNodes,
  type ChatComposerNode,
} from '@nextclaw/agent-chat-ui';
import type { NcpMessage } from '@nextclaw/ncp';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import { CHAT_SYSTEM_OBJECT_TOKEN_KIND } from '@nextclaw/shared';

import { deriveChatComposerDraft } from '@/features/chat/features/input/utils/chat-composer-state.utils';
import {
  readInlineTokensFromMetadata,
  resolveInlineTokensForText,
  type ChatInlineTokenSource,
} from '@/features/chat/features/input/utils/chat-inline-token.utils';
import type { SessionConversationComposerState } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';

export type SessionMessageComposerSnapshot = SessionConversationComposerState & {
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
      tokenKey: 'ref' in nextToken.token ? nextToken.token.ref : nextToken.token.key,
      label: nextToken.token.label,
      data: nextToken.token.kind === CHAT_SYSTEM_OBJECT_TOKEN_KIND &&
        'reference' in nextToken.token
        ? { reference: nextToken.token.reference }
        : undefined,
    }));
    offset = nextToken.index + nextToken.token.rawText.length;
  }
  return nodes;
}

export function buildSessionMessageComposerSnapshot(params: {
  readonly attachmentIdPrefix: string;
  readonly availableSkills: readonly { ref: string; name: string }[];
  readonly message: NcpMessage;
  readonly metadata?: Record<string, unknown>;
}): SessionMessageComposerSnapshot {
  const { attachmentIdPrefix, availableSkills, message } = params;
  const metadata = params.metadata ?? message.metadata ?? {};
  const metadataTokens = readInlineTokensFromMetadata(metadata);
  const nodes: ChatComposerNode[] = [];
  const attachments: NcpDraftAttachment[] = [];

  message.parts.forEach((part, index) => {
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
    const id = `${attachmentIdPrefix}-${index}`;
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
      previewUrl: attachment.mimeType.startsWith('image/') ? attachment.url : undefined,
    }));
  });

  const normalizedNodes = normalizeChatComposerNodes(nodes);
  const skillTokens = metadataTokens.filter(
    (token): token is Extract<ChatInlineTokenSource, { kind: 'skill' }> =>
      token.kind === 'skill',
  );
  const selectedSkills = [...new Set(skillTokens.map((token) => token.ref))];
  const skillNameByRef = new Map(availableSkills.map(({ ref, name }) => [ref, name]));
  for (const token of skillTokens) {
    if (!skillNameByRef.has(token.ref)) {
      skillNameByRef.set(token.ref, token.name);
    }
  }
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
