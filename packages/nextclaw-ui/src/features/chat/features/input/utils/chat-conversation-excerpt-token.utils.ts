import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import {
  CHAT_CONVERSATION_EXCERPT_TOKEN_KIND,
  type ChatConversationExcerptInlineTokenMetadata,
} from '@nextclaw/shared';

type ComposerTokenNode = Extract<ChatComposerNode, { type: 'token' }>;

function readRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readConversationExcerptFields(source: Record<string, unknown>): {
  messageId: string;
  role: 'assistant' | 'user';
  excerpt: string;
} | null {
  const messageId = readRequiredString(source.messageId);
  const excerpt = readRequiredString(source.excerpt);
  const { role } = source;
  return messageId && excerpt && (role === 'assistant' || role === 'user')
    ? { messageId, role, excerpt }
    : null;
}

export function buildConversationExcerptInlineToken(
  node: ComposerTokenNode,
  rawText: string,
): ChatConversationExcerptInlineTokenMetadata | null {
  const fields = readConversationExcerptFields(node.data ?? {});
  return fields
    ? {
        kind: CHAT_CONVERSATION_EXCERPT_TOKEN_KIND,
        key: node.tokenKey,
        label: node.label,
        rawText,
        ...fields,
      }
    : null;
}

export function readConversationExcerptInlineToken(params: {
  entry: Record<string, unknown>;
  label: string;
  rawText: string;
}): ChatConversationExcerptInlineTokenMetadata | null {
  const { entry, label, rawText } = params;
  const key = readRequiredString(entry.key);
  const fields = readConversationExcerptFields(entry);
  return key && fields
    ? {
        kind: CHAT_CONVERSATION_EXCERPT_TOKEN_KIND,
        key,
        label,
        rawText,
        ...fields,
      }
    : null;
}
