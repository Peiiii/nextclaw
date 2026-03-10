import type { UIMessage, UiMessageStatus } from '../types/ui-message.js';

export function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return true;
    }
    const lower = error.message.toLowerCase();
    return lower.includes('aborted') || lower.includes('abort');
  }
  return false;
}

export function formatSendError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }
  const raw = String(error ?? '').trim();
  return raw || 'Failed to send message';
}

export function buildLocalAssistantMessage(text: string, options?: { sessionKey?: string; status?: UiMessageStatus }): UIMessage {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    parts: [{ type: 'text', text }],
    meta: {
      source: 'local',
      status: options?.status ?? 'final',
      sessionKey: options?.sessionKey,
      timestamp: new Date().toISOString()
    }
  };
}
