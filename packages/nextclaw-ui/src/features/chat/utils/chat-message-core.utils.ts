import type { SessionEventView, SessionMessageView } from '@/api/types';

export type ChatRole = 'user' | 'assistant' | 'tool' | 'system' | 'other';

export type ToolCard = {
  kind: 'call' | 'result';
  name: string;
  detail?: string;
  text?: string;
  callId?: string;
  hasResult?: boolean;
};

const TOOL_DETAIL_FIELDS = ['cmd', 'command', 'query', 'q', 'path', 'url', 'to', 'channel', 'agentId', 'sessionKey'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function truncateText(value: string, maxChars = 2400): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n…`;
}

function truncateInlineText(value: string, maxChars = 120): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  if (maxChars <= 1) {
    return '…';
  }
  return `${normalized.slice(0, maxChars - 1)}…`;
}

export function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value == null) {
    return '';
  }
  try {
    return truncateText(JSON.stringify(value, null, 2));
  } catch {
    return String(value);
  }
}

function parseArgsObject(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function summarizeToolArgs(args: unknown): string | undefined {
  const parsed = parseArgsObject(args);
  if (!parsed) {
    const text = stringifyUnknown(args).trim();
    return text ? truncateInlineText(text, 120) : undefined;
  }

  const items: string[] = [];
  for (const field of TOOL_DETAIL_FIELDS) {
    const value = parsed[field];
    if (typeof value === 'string' && value.trim()) {
      items.push(`${field}: ${value.trim()}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      items.push(`${field}: ${String(value)}`);
    }
    if (items.length >= 2) {
      break;
    }
  }
  if (items.length > 0) {
    return truncateInlineText(items.join(' · '), 120);
  }
  return truncateInlineText(stringifyUnknown(parsed), 140);
}

function toToolName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'tool';
  }
  return value.trim();
}

function hasToolCalls(message: SessionMessageView): boolean {
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

export function normalizeChatRole(message: Pick<SessionMessageView, 'role' | 'name' | 'tool_call_id' | 'tool_calls'>): ChatRole {
  const role = message.role.toLowerCase().trim();
  if (role === 'user') {
    return 'user';
  }
  if (role === 'assistant') {
    return 'assistant';
  }
  if (role === 'system') {
    return 'system';
  }
  if (role === 'tool' || role === 'tool_result' || role === 'toolresult' || role === 'function') {
    return 'tool';
  }
  if (typeof message.tool_call_id === 'string' || Array.isArray(message.tool_calls) || typeof message.name === 'string') {
    return 'tool';
  }
  return 'other';
}

export function extractMessageText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item === 'string') {
        parts.push(item);
        continue;
      }
      if (!isRecord(item)) {
        continue;
      }
      if (typeof item.text === 'string') {
        parts.push(item.text);
        continue;
      }
      if (typeof item.content === 'string') {
        parts.push(item.content);
      }
    }
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }
  return stringifyUnknown(content);
}

function buildToolCallCards(message: SessionMessageView): ToolCard[] {
  const cards: ToolCard[] = [];
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (const call of toolCalls) {
    if (!isRecord(call)) {
      continue;
    }
    const fn = isRecord(call.function) ? call.function : null;
    const name = toToolName(fn?.name ?? call.name);
    const args = fn?.arguments ?? call.arguments;
    cards.push({
      kind: 'call',
      name,
      detail: summarizeToolArgs(args),
      callId: typeof call.id === 'string' && call.id.trim() ? call.id : undefined,
      hasResult: false
    });
  }
  return cards;
}

export function extractToolCards(message: SessionMessageView): ToolCard[] {
  const cards = buildToolCallCards(message);
  const role = normalizeChatRole(message);
  if (role === 'tool' || typeof message.tool_call_id === 'string') {
    cards.push({
      kind: 'result',
      name: toToolName(message.name ?? cards[0]?.name),
      text: extractMessageText(message.content).trim(),
      callId: typeof message.tool_call_id === 'string' ? message.tool_call_id : undefined,
      hasResult: true
    });
  }
  return cards;
}

function inferEventTypeFromMessage(message: SessionMessageView): string {
  const role = normalizeChatRole(message);
  if (role === 'assistant' && hasToolCalls(message)) {
    return 'assistant.tool_call';
  }
  if (role === 'tool') {
    return 'tool.result';
  }
  return `message.${role}`;
}

export function buildFallbackEventsFromMessages(messages: SessionMessageView[]): SessionEventView[] {
  return messages.map((message, index) => ({
    seq: index + 1,
    type: inferEventTypeFromMessage(message),
    timestamp: message.timestamp,
    message
  }));
}
