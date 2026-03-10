import type { SessionMessageView } from '@/api/types';
import { extractMessageText } from '@/lib/chat-message';
import { ToolInvocationStatus, type UIMessage } from '@nextclaw/agent-chat';

export { isAbortLikeError, formatSendError, buildLocalAssistantMessage } from '@nextclaw/agent-chat';

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
  const normalizedToolRoles = new Set(['tool', 'tool_result', 'toolresult', 'function']);
  const output: UIMessage[] = [];
  let cursor = 0;
  let assistantIndex = 0;
  let activeAssistant: UIMessage | null = null;

  const buildId = (role: UIMessage['role'], timestamp: string) => {
    cursor += 1;
    return `history-${role}-${timestamp || 'unknown'}-${cursor}`;
  };

  const parseArgsPayload = (raw: unknown): { args: string; parsedArgs?: unknown } => {
    const args = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
    try {
      return { args, parsedArgs: JSON.parse(args) };
    } catch {
      return { args };
    }
  };

  const findToolPartIndex = (parts: UIMessage['parts'], toolCallId: string): number => {
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const part = parts[index];
      if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId) {
        return index;
      }
    }
    return -1;
  };

  const ensureAssistant = (timestamp: string): UIMessage => {
    if (activeAssistant) {
      activeAssistant = {
        ...activeAssistant,
        meta: {
          ...activeAssistant.meta,
          timestamp
        }
      };
      return activeAssistant;
    }
    assistantIndex += 1;
    activeAssistant = {
      id: `history-assistant-${assistantIndex}-${timestamp || 'unknown'}`,
      role: 'assistant',
      parts: [],
      meta: {
        source: 'history',
        status: 'final',
        timestamp
      }
    };
    return activeAssistant;
  };

  const flushAssistant = () => {
    if (!activeAssistant) {
      return;
    }
    if (activeAssistant.parts.length > 0) {
      output.push(activeAssistant);
    }
    activeAssistant = null;
  };

  const appendAssistantText = (timestamp: string, text: string) => {
    if (!text) {
      return;
    }
    const assistant = ensureAssistant(timestamp);
    assistant.parts = [...assistant.parts, { type: 'text', text }];
  };

  const appendAssistantReasoning = (timestamp: string, reasoning: string) => {
    if (!reasoning) {
      return;
    }
    const assistant = ensureAssistant(timestamp);
    assistant.parts = [...assistant.parts, { type: 'reasoning', reasoning, details: [] }];
  };

  const appendAssistantToolCall = (params: {
    timestamp: string;
    toolCallId: string;
    toolName: string;
    args: string;
    parsedArgs?: unknown;
  }) => {
    const assistant = ensureAssistant(params.timestamp);
    const partIndex = findToolPartIndex(assistant.parts, params.toolCallId);
    const part = {
      type: 'tool-invocation' as const,
      toolInvocation: {
        status: ToolInvocationStatus.CALL,
        toolCallId: params.toolCallId,
        toolName: params.toolName,
        args: params.args,
        parsedArgs: params.parsedArgs
      }
    };
    if (partIndex >= 0) {
      assistant.parts = [...assistant.parts.slice(0, partIndex), part, ...assistant.parts.slice(partIndex + 1)];
      return;
    }
    assistant.parts = [...assistant.parts, part];
  };

  const appendAssistantToolResult = (params: {
    timestamp: string;
    toolCallId: string;
    toolName: string;
    result: unknown;
  }) => {
    if (!params.toolCallId) {
      return;
    }
    const assistant = ensureAssistant(params.timestamp);
    const partIndex = findToolPartIndex(assistant.parts, params.toolCallId);
    if (partIndex < 0) {
      assistant.parts = [
        ...assistant.parts,
        {
          type: 'tool-invocation',
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: params.toolCallId,
            toolName: params.toolName,
            args: '{}',
            parsedArgs: undefined,
            result: params.result
          }
        }
      ];
      return;
    }
    const part = assistant.parts[partIndex];
    if (part.type !== 'tool-invocation') {
      return;
    }
    assistant.parts = [
      ...assistant.parts.slice(0, partIndex),
      {
        ...part,
        toolInvocation: {
          ...part.toolInvocation,
          status: ToolInvocationStatus.RESULT,
          result: params.result
        }
      },
      ...assistant.parts.slice(partIndex + 1)
    ];
  };

  for (const message of messages) {
    const roleValue = message.role?.toLowerCase().trim();
    if (!roleValue) {
      continue;
    }
    const timestamp = message.timestamp;

    if (roleValue === 'user' || roleValue === 'system' || roleValue === 'data') {
      flushAssistant();
      const text = extractMessageText(message.content).trim();
      if (!text) {
        continue;
      }
      output.push({
        id: buildId(roleValue as UIMessage['role'], timestamp),
        role: roleValue as UIMessage['role'],
        parts: [{ type: 'text', text }],
        meta: {
          source: 'history',
          status: 'final',
          timestamp
        }
      });
      continue;
    }

    if (roleValue === 'assistant') {
      const text = extractMessageText(message.content).trim();
      if (text) {
        appendAssistantText(timestamp, text);
      }
      if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
        appendAssistantReasoning(timestamp, message.reasoning_content.trim());
      }
      if (Array.isArray(message.tool_calls)) {
        for (const call of message.tool_calls) {
          if (!call || typeof call !== 'object') {
            continue;
          }
          const callRecord = call as Record<string, unknown>;
          const fnValue = callRecord.function;
          const fn = typeof fnValue === 'object' && fnValue ? (fnValue as { name?: unknown; arguments?: unknown }) : null;
          const toolCallId = typeof callRecord.id === 'string' ? callRecord.id.trim() : '';
          if (!toolCallId) {
            continue;
          }
          const toolName =
            typeof fn?.name === 'string' ? fn.name : typeof callRecord.name === 'string' ? callRecord.name : 'tool';
          const payload = parseArgsPayload(fn?.arguments ?? callRecord.arguments ?? '');
          appendAssistantToolCall({
            timestamp,
            toolCallId,
            toolName,
            args: payload.args,
            parsedArgs: payload.parsedArgs
          });
        }
      }
      continue;
    }

    if (normalizedToolRoles.has(roleValue)) {
      const toolCallId = typeof message.tool_call_id === 'string' ? message.tool_call_id.trim() : '';
      const toolName = typeof message.name === 'string' && message.name.trim() ? message.name.trim() : 'tool';
      appendAssistantToolResult({
        timestamp,
        toolCallId,
        toolName,
        result: message.content
      });
    }
  }

  flushAssistant();
  return output;
}
