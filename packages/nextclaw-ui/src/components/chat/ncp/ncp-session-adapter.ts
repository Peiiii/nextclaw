import { ToolInvocationStatus, type UIMessage } from '@nextclaw/agent-chat';
import type { NcpMessagePart } from '@nextclaw/ncp';
import type { NcpMessageView, NcpSessionSummaryView, SessionEntryView, ThinkingLevel } from '@/api/types';

const THINKING_LEVEL_SET = new Set<string>(['off', 'minimal', 'low', 'medium', 'high', 'adaptive', 'xhigh']);

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return String(value ?? '');
  }
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readMetadata(summary: NcpSessionSummaryView): Record<string, unknown> | null {
  const { metadata } = summary;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  return metadata as Record<string, unknown>;
}

export function readNcpSessionPreferredModel(summary: NcpSessionSummaryView): string | null {
  const metadata = readMetadata(summary);
  if (!metadata) {
    return null;
  }
  return (
    readOptionalString(metadata.preferred_model) ??
    readOptionalString(metadata.preferredModel) ??
    readOptionalString(metadata.model)
  );
}

export function readNcpSessionPreferredThinking(summary: NcpSessionSummaryView): ThinkingLevel | null {
  const metadata = readMetadata(summary);
  if (!metadata) {
    return null;
  }
  const rawValue =
    readOptionalString(metadata.preferred_thinking) ??
    readOptionalString(metadata.thinking) ??
    readOptionalString(metadata.thinking_level) ??
    readOptionalString(metadata.thinkingLevel);
  if (!rawValue) {
    return null;
  }
  const normalized = rawValue.toLowerCase();
  return THINKING_LEVEL_SET.has(normalized) ? (normalized as ThinkingLevel) : null;
}

function readNcpSessionLabel(summary: NcpSessionSummaryView): string | null {
  const metadata = readMetadata(summary);
  if (!metadata) {
    return null;
  }
  return readOptionalString(metadata.label);
}

function readNcpSessionType(summary: NcpSessionSummaryView): string {
  const metadata = readMetadata(summary);
  if (!metadata) {
    return 'native';
  }
  return readOptionalString(metadata.session_type) ?? readOptionalString(metadata.sessionType) ?? 'native';
}

function parseSessionContext(sessionKey: string): { channel?: string; type?: string } {
  if (sessionKey === 'heartbeat') {
    return { type: 'heartbeat' };
  }
  if (sessionKey.startsWith('cron:')) {
    return { type: 'cron' };
  }
  if (sessionKey.startsWith('agent:')) {
    const parts = sessionKey.split(':');
    if (parts.length >= 3) {
      const channel = parts[2];
      if (channel && channel !== 'main' && channel !== 'direct') {
        return { channel };
      }
    }
  }
  return {};
}

function mapToolStatus(part: Extract<NcpMessagePart, { type: 'tool-invocation' }>): ToolInvocationStatus {
  if (part.state === 'result') {
    return ToolInvocationStatus.RESULT;
  }
  if (part.state === 'partial-call') {
    return ToolInvocationStatus.PARTIAL_CALL;
  }
  return ToolInvocationStatus.CALL;
}

function toUiParts(parts: NcpMessagePart[]): UIMessage['parts'] {
  const uiParts: UIMessage['parts'] = [];
  for (const part of parts) {
    if (part.type === 'text') {
      uiParts.push({ type: 'text', text: part.text });
      continue;
    }
    if (part.type === 'rich-text') {
      uiParts.push({ type: 'text', text: part.text });
      continue;
    }
    if (part.type === 'reasoning') {
      uiParts.push({
        type: 'reasoning',
        reasoning: part.text,
        details: []
      });
      continue;
    }
    if (part.type === 'source') {
      uiParts.push({
        type: 'source',
        source: {
          sourceType: 'url',
          id: part.url ?? part.title ?? Math.random().toString(36).slice(2, 8),
          url: part.url ?? '',
          ...(part.title ? { title: part.title } : {})
        }
      });
      continue;
    }
    if (part.type === 'file' && part.contentBase64) {
      uiParts.push({
        type: 'file',
        ...(part.name ? { name: part.name } : {}),
        mimeType: part.mimeType ?? 'application/octet-stream',
        data: part.contentBase64,
        ...(part.url ? { url: part.url } : {}),
        ...(typeof part.sizeBytes === 'number' ? { sizeBytes: part.sizeBytes } : {})
      });
      continue;
    }
    if (part.type === 'file' && part.url) {
      uiParts.push({
        type: 'file',
        ...(part.name ? { name: part.name } : {}),
        mimeType: part.mimeType ?? 'application/octet-stream',
        data: '',
        url: part.url,
        ...(typeof part.sizeBytes === 'number' ? { sizeBytes: part.sizeBytes } : {})
      });
      continue;
    }
    if (part.type === 'step-start') {
      uiParts.push({ type: 'step-start' });
      continue;
    }
    if (part.type === 'tool-invocation') {
      uiParts.push({
        type: 'tool-invocation',
        toolInvocation: {
          status: mapToolStatus(part),
          toolCallId: part.toolCallId ?? `${part.toolName}-${Math.random().toString(36).slice(2, 8)}`,
          toolName: part.toolName,
          args: stringifyUnknown(part.args),
          result: part.result
        }
      });
    }
  }
  return uiParts;
}

function normalizeRole(role: NcpMessageView['role']): UIMessage['role'] {
  if (role === 'service') {
    return 'system';
  }
  return role === 'tool' ? 'assistant' : role;
}

export function adaptNcpMessageToUiMessage(message: NcpMessageView): UIMessage {
  return {
    id: message.id,
    role: normalizeRole(message.role),
    parts: toUiParts(message.parts),
    meta: {
      source: 'stream',
      status: message.status,
      sessionKey: message.sessionId,
      timestamp: message.timestamp
    }
  };
}

export function adaptNcpMessagesToUiMessages(messages: readonly NcpMessageView[]): UIMessage[] {
  return messages.map(adaptNcpMessageToUiMessage);
}

export function adaptNcpSessionSummary(summary: NcpSessionSummaryView): SessionEntryView {
  const label = readNcpSessionLabel(summary);
  const preferredModel = readNcpSessionPreferredModel(summary);
  const preferredThinking = readNcpSessionPreferredThinking(summary);
  const context = parseSessionContext(summary.sessionId);
  return {
    key: summary.sessionId,
    createdAt: summary.updatedAt,
    updatedAt: summary.updatedAt,
    ...(label ? { label } : {}),
    ...context,
    ...(preferredModel ? { preferredModel } : {}),
    ...(preferredThinking ? { preferredThinking } : {}),
    sessionType: readNcpSessionType(summary),
    sessionTypeMutable: false,
    messageCount: summary.messageCount
  };
}

export function adaptNcpSessionSummaries(summaries: NcpSessionSummaryView[]): SessionEntryView[] {
  return summaries.map(adaptNcpSessionSummary);
}

export function createNcpSessionId(): string {
  return `ncp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
