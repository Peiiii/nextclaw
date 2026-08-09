import type {
  ChatComposerNode,
  ChatComposerTokenNode,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import {
  createChatComposerTextNode,
  createChatComposerTokenNode,
  getChatComposerNodeLength,
  normalizeChatComposerNodes,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';

export const CHAT_COMPOSER_CLIPBOARD_MIME_TYPE =
  'application/x-nextclaw-chat-composer+json';

const CHAT_COMPOSER_CLIPBOARD_VERSION = 1;
const CHAT_COMPOSER_CLIPBOARD_MAX_BYTES = 1_000_000;
const CHAT_COMPOSER_CLIPBOARD_MAX_NODES = 1_000;
const CHAT_COMPOSER_CLIPBOARD_MAX_FIELD_LENGTH = 100_000;

type ChatComposerClipboardNode =
  | { type: 'text'; text: string }
  | {
      type: 'token';
      tokenKind: string;
      tokenKey: string;
      label: string;
      previewUrl?: string;
      data?: Record<string, unknown>;
    };

type ChatComposerClipboardPayload = {
  version: 1;
  nodes: ChatComposerClipboardNode[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= CHAT_COMPOSER_CLIPBOARD_MAX_FIELD_LENGTH
    ? value
    : null;
}

function readOptionalString(value: unknown): string | undefined | null {
  return value === undefined
    ? undefined
    : typeof value === 'string' && value.length <= CHAT_COMPOSER_CLIPBOARD_MAX_FIELD_LENGTH
      ? value
      : null;
}

function cloneTokenNode(node: ChatComposerTokenNode): ChatComposerTokenNode {
  return createChatComposerTokenNode({
    data: node.data,
    label: node.label,
    previewUrl: node.previewUrl,
    tokenKey: node.tokenKey,
    tokenKind: node.tokenKind,
  });
}

export function sliceChatComposerRange(
  nodes: readonly ChatComposerNode[],
  start: number,
  end: number,
): ChatComposerNode[] {
  const boundedStart = Math.max(0, Math.min(start, end));
  const boundedEnd = Math.max(boundedStart, Math.max(start, end));
  const selectedNodes: ChatComposerNode[] = [];
  let cursor = 0;

  for (const node of nodes) {
    const nodeStart = cursor;
    const nodeEnd = nodeStart + getChatComposerNodeLength(node);
    cursor = nodeEnd;
    if (nodeEnd <= boundedStart || nodeStart >= boundedEnd) {
      continue;
    }
    if (node.type === 'token') {
      selectedNodes.push(cloneTokenNode(node));
      continue;
    }
    const textStart = Math.max(0, boundedStart - nodeStart);
    const textEnd = Math.min(node.text.length, boundedEnd - nodeStart);
    if (textEnd > textStart) {
      selectedNodes.push(createChatComposerTextNode(node.text.slice(textStart, textEnd)));
    }
  }

  return selectedNodes.length > 0 ? normalizeChatComposerNodes(selectedNodes) : [];
}

function toClipboardNode(node: ChatComposerNode): ChatComposerClipboardNode {
  return node.type === 'text'
    ? { type: 'text', text: node.text }
    : {
        type: 'token',
        tokenKind: node.tokenKind,
        tokenKey: node.tokenKey,
        label: node.label,
        previewUrl: node.previewUrl,
        data: node.data,
      };
}

export function serializeChatComposerClipboard(nodes: readonly ChatComposerNode[]): string {
  const payload: ChatComposerClipboardPayload = {
    version: CHAT_COMPOSER_CLIPBOARD_VERSION,
    nodes: nodes.map(toClipboardNode),
  };
  return JSON.stringify(payload);
}

function readClipboardNode(value: unknown): ChatComposerNode | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.type === 'text') {
    const text = readOptionalString(value.text);
    return typeof text === 'string' ? createChatComposerTextNode(text) : null;
  }
  if (value.type !== 'token') {
    return null;
  }
  const tokenKind = readRequiredString(value.tokenKind);
  const tokenKey = readRequiredString(value.tokenKey);
  const label = readRequiredString(value.label);
  const previewUrl = readOptionalString(value.previewUrl);
  const data = value.data === undefined
    ? undefined
    : isRecord(value.data)
      ? value.data
      : null;
  if (!tokenKind || !tokenKey || !label || previewUrl === null || data === null) {
    return null;
  }
  return createChatComposerTokenNode({
    data,
    label,
    previewUrl,
    tokenKey,
    tokenKind,
  });
}

export function parseChatComposerClipboard(value: string): ChatComposerNode[] | null {
  if (!value || value.length > CHAT_COMPOSER_CLIPBOARD_MAX_BYTES) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== CHAT_COMPOSER_CLIPBOARD_VERSION ||
    !Array.isArray(parsed.nodes) ||
    parsed.nodes.length === 0 ||
    parsed.nodes.length > CHAT_COMPOSER_CLIPBOARD_MAX_NODES
  ) {
    return null;
  }
  const nodes: ChatComposerNode[] = [];
  for (const entry of parsed.nodes) {
    const node = readClipboardNode(entry);
    if (!node) {
      return null;
    }
    nodes.push(node);
  }
  return normalizeChatComposerNodes(nodes);
}

function serializeWorkspaceExcerptToken(node: ChatComposerTokenNode): string | null {
  if (node.tokenKind !== 'workspace_excerpt' || typeof node.data?.excerpt !== 'string') {
    return null;
  }
  const startLine = typeof node.data.startLine === 'number' ? node.data.startLine : null;
  const endLine = typeof node.data.endLine === 'number' ? node.data.endLine : null;
  const location = startLine
    ? startLine === endLine || !endLine
      ? ` L${startLine}`
      : ` L${startLine}–${endLine}`
    : '';
  return `[${node.label}${location}]\n${node.data.excerpt}`;
}

function serializeConversationExcerptToken(node: ChatComposerTokenNode): string | null {
  return node.tokenKind === 'conversation_excerpt' && typeof node.data?.excerpt === 'string'
    ? `[${node.label}]\n${node.data.excerpt}`
    : null;
}

export function serializeChatComposerClipboardPlainText(
  nodes: readonly ChatComposerNode[],
): string {
  return nodes.map((node) => {
    if (node.type === 'text') {
      return node.text;
    }
    return serializeWorkspaceExcerptToken(node) ??
      serializeConversationExcerptToken(node) ??
      `@${node.label}`;
  }).join('');
}
