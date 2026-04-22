import type { SessionMessageView } from '@/shared/lib/api';
import { extractMessageText } from './chat-message-core.utils';
import { ToolInvocationStatus, type UIMessage } from '@nextclaw/agent-chat';

export { isAbortLikeError, formatSendError, buildLocalAssistantMessage } from '@nextclaw/agent-chat';

const HISTORY_TOOL_ROLES = new Set(['tool', 'tool_result', 'toolresult', 'function']);

type ToolArgsPayload = {
  args: string;
  parsedArgs?: unknown;
};

function parseToolArgsPayload(raw: unknown): ToolArgsPayload {
  const args = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
  try {
    return { args, parsedArgs: JSON.parse(args) };
  } catch {
    return { args };
  }
}

function findToolPartIndex(parts: UIMessage['parts'], toolCallId: string): number {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId) {
      return index;
    }
  }
  return -1;
}

class HistoryMessageBuilder {
  private readonly output: UIMessage[] = [];
  private cursor = 0;
  private assistantIndex = 0;
  private activeAssistant: UIMessage | null = null;

  build = (messages: SessionMessageView[]): UIMessage[] => {
    for (const message of messages) {
      const role = message.role?.toLowerCase().trim();
      if (!role) continue;
      if (role === 'user' || role === 'system' || role === 'data') {
        this.appendTextMessage(message, role as UIMessage['role']);
        continue;
      }
      if (role === 'assistant') {
        this.appendAssistantMessage(message);
        continue;
      }

      if (HISTORY_TOOL_ROLES.has(role)) {
        this.appendToolResult(message);
      }
    }

    this.flushAssistant();
    return this.output;
  };

  private buildId = (role: UIMessage['role'], timestamp: string): string => {
    this.cursor += 1;
    return `history-${role}-${timestamp || 'unknown'}-${this.cursor}`;
  };

  private ensureAssistant = (timestamp: string): UIMessage => {
    if (!this.activeAssistant) {
      this.assistantIndex += 1;
      this.activeAssistant = {
        id: `history-assistant-${this.assistantIndex}-${timestamp || 'unknown'}`,
        role: 'assistant',
        parts: [],
        meta: { source: 'history', status: 'final', timestamp }
      };
      return this.activeAssistant;
    }

    this.activeAssistant = {
      ...this.activeAssistant,
      meta: { ...this.activeAssistant.meta, timestamp }
    };
    return this.activeAssistant;
  };

  private flushAssistant = (): void => {
    if (this.activeAssistant?.parts.length) {
      this.output.push(this.activeAssistant);
    }
    this.activeAssistant = null;
  };

  private appendTextMessage = (message: SessionMessageView, role: UIMessage['role']): void => {
    this.flushAssistant();
    const text = extractMessageText(message.content).trim();
    if (!text) return;
    this.output.push({
      id: this.buildId(role, message.timestamp),
      role,
      parts: [{ type: 'text', text }],
      meta: { source: 'history', status: 'final', timestamp: message.timestamp }
    });
  };

  private appendAssistantText = (timestamp: string, text: string): void => {
    if (!text) return;
    const assistant = this.ensureAssistant(timestamp);
    assistant.parts = [...assistant.parts, { type: 'text', text }];
  };

  private appendAssistantReasoning = (timestamp: string, reasoning: string): void => {
    if (!reasoning) return;
    const assistant = this.ensureAssistant(timestamp);
    assistant.parts = [...assistant.parts, { type: 'reasoning', reasoning, details: [] }];
  };

  private appendAssistantToolCall = (params: {
    timestamp: string;
    toolCallId: string;
    toolName: string;
    args: string;
    parsedArgs?: unknown;
  }): void => {
    const { timestamp, toolCallId, toolName, args, parsedArgs } = params;
    const assistant = this.ensureAssistant(timestamp);
    const partIndex = findToolPartIndex(assistant.parts, toolCallId);
    const part = {
      type: 'tool-invocation' as const,
      toolInvocation: {
        status: ToolInvocationStatus.CALL,
        toolCallId,
        toolName,
        args,
        parsedArgs
      }
    };
    assistant.parts =
      partIndex >= 0
        ? [...assistant.parts.slice(0, partIndex), part, ...assistant.parts.slice(partIndex + 1)]
        : [...assistant.parts, part];
  };

  private appendToolResult = (message: SessionMessageView): void => {
    const toolCallId = typeof message.tool_call_id === 'string' ? message.tool_call_id.trim() : '';
    if (!toolCallId) return;
    const assistant = this.ensureAssistant(message.timestamp);
    const partIndex = findToolPartIndex(assistant.parts, toolCallId);
    const toolName = typeof message.name === 'string' && message.name.trim() ? message.name.trim() : 'tool';
    if (partIndex < 0) {
      assistant.parts = [
        ...assistant.parts,
        {
          type: 'tool-invocation',
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId,
            toolName,
            args: '{}',
            parsedArgs: undefined,
            result: message.content
          }
        }
      ];
      return;
    }
    const part = assistant.parts[partIndex];
    if (part.type !== 'tool-invocation') return;
    assistant.parts = [
      ...assistant.parts.slice(0, partIndex),
      {
        ...part,
        toolInvocation: {
          ...part.toolInvocation,
          status: ToolInvocationStatus.RESULT,
          result: message.content
        }
      },
      ...assistant.parts.slice(partIndex + 1)
    ];
  };

  private appendAssistantMessage = (message: SessionMessageView): void => {
    const timestamp = message.timestamp;
    const text = extractMessageText(message.content).trim();
    if (text) {
      this.appendAssistantText(timestamp, text);
    }
    if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
      this.appendAssistantReasoning(timestamp, message.reasoning_content.trim());
    }
    if (!Array.isArray(message.tool_calls)) return;
    for (const call of message.tool_calls) {
      if (!call || typeof call !== 'object') {
        continue;
      }
      const callRecord = call as Record<string, unknown>;
      const functionValue = callRecord.function;
      const fn =
        typeof functionValue === 'object' && functionValue
          ? (functionValue as { name?: unknown; arguments?: unknown })
          : null;
      const toolCallId = typeof callRecord.id === 'string' ? callRecord.id.trim() : '';
      if (!toolCallId) {
        continue;
      }
      const toolName =
        typeof fn?.name === 'string' ? fn.name : typeof callRecord.name === 'string' ? callRecord.name : 'tool';
      const payload = parseToolArgsPayload(fn?.arguments ?? callRecord.arguments ?? '');
      this.appendAssistantToolCall({
        timestamp,
        toolCallId,
        toolName,
        args: payload.args,
        parsedArgs: payload.parsedArgs
      });
    }
  };
}

export function normalizeRequestedSkills(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const deduped = new Set<string>();
  for (const item of value) {
    const trimmed = item.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }
  return [...deduped];
}

export function buildUiMessagesFromHistoryMessages(messages: SessionMessageView[]): UIMessage[] {
  return new HistoryMessageBuilder().build(messages);
}
