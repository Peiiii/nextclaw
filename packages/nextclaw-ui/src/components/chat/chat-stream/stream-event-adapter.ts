import { EventType, type AgentEvent } from '@nextclaw/agent-chat';
import type { SessionEventView } from '@/api/types';

export function buildDeltaEvents(params: { messageId: string; delta: string; started: boolean }): AgentEvent[] {
  if (!params.delta) {
    return [];
  }
  if (params.started) {
    return [{ type: EventType.TEXT_DELTA, messageId: params.messageId, delta: params.delta }];
  }
  return [
    { type: EventType.TEXT_START, messageId: params.messageId },
    { type: EventType.TEXT_DELTA, messageId: params.messageId, delta: params.delta }
  ];
}

export function shouldCloseDeltaOnSessionEvent(event: SessionEventView): boolean {
  void event;
  return false;
}

export function isAssistantSessionEvent(event: SessionEventView): boolean {
  const role = event.message?.role?.toLowerCase().trim();
  return role === 'assistant';
}

export function buildSessionEventEvents(params: { event: SessionEventView; messageId: string }): AgentEvent[] {
  const { event, messageId } = params;
  const message = event.message;
  if (!message) {
    return [];
  }
  const role = message.role?.toLowerCase().trim();
  if (!role) {
    return [];
  }

  const events: AgentEvent[] = [];

  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
    events.push({ type: EventType.REASONING_START, messageId });
    events.push({
      type: EventType.REASONING_DELTA,
      messageId,
      delta: message.reasoning_content.trim()
    });
    events.push({ type: EventType.REASONING_END, messageId });
  }

  if (Array.isArray(message.tool_calls)) {
    for (let index = 0; index < message.tool_calls.length; index += 1) {
      const call = message.tool_calls[index];
      if (!call || typeof call !== 'object') {
        continue;
      }
      const callRecord = call as Record<string, unknown>;
      const fnValue = callRecord.function;
      const fn = typeof fnValue === 'object' && fnValue ? (fnValue as { name?: unknown; arguments?: unknown }) : null;
      const seqPrefix = typeof event.seq === 'number' ? String(event.seq) : 'unknown';
      const toolCallId = typeof callRecord.id === 'string' ? callRecord.id : `tool-${seqPrefix}-${index}`;
      const toolName = typeof fn?.name === 'string' ? fn.name : typeof callRecord.name === 'string' ? callRecord.name : 'tool';
      const rawArgs = fn?.arguments ?? callRecord.arguments ?? '';
      const args = typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs ?? {});
      events.push({
        type: EventType.TOOL_CALL_START,
        messageId,
        toolCallId,
        toolName
      });
      events.push({
        type: EventType.TOOL_CALL_ARGS,
        toolCallId,
        args
      });
      events.push({
        type: EventType.TOOL_CALL_END,
        toolCallId
      });
    }
  }

  if (role === 'tool' || role === 'tool_result' || role === 'toolresult' || role === 'function') {
    const toolCallId = typeof message.tool_call_id === 'string' ? message.tool_call_id.trim() : '';
    if (toolCallId) {
      events.push({
        type: EventType.TOOL_CALL_RESULT,
        toolCallId,
        content: message.content
      });
    }
  }

  return events;
}

export function buildDeltaMessageId(): string {
  return `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
