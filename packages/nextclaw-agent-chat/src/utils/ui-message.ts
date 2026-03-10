import { ToolInvocationStatus, type ToolCall } from '../types/agent.js';
import type { ToolInvocation, UIMessage } from '../types/ui-message.js';

const tryParseJson = (jsonString: string) => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return undefined;
  }
};

export const toolCallToToolInvocation = (toolCall: ToolCall): ToolInvocation => {
  return {
    toolCallId: toolCall.id,
    toolName: toolCall.function.name,
    args: toolCall.function.arguments,
    parsedArgs: tryParseJson(toolCall.function.arguments),
    status: ToolInvocationStatus.CALL
  };
};

export function finalizePendingToolInvocations(
  messages: UIMessage[],
  options?: { stubResult?: unknown }
): UIMessage[] {
  const stub = options?.stubResult ?? {
    error: 'tool_call_interrupted',
    note: 'User continued before tool produced a result.'
  };
  return messages.map((msg) => {
    if (!msg.parts?.length) return msg;
    return {
      ...msg,
      parts: msg.parts.map((part) => {
        if (part.type !== 'tool-invocation') return part;
        if (![ToolInvocationStatus.CALL, ToolInvocationStatus.PARTIAL_CALL].includes(part.toolInvocation.status)) return part;

        let parsedArgs;
        if (typeof part.toolInvocation.args === 'string') {
          try {
            parsedArgs = JSON.parse(part.toolInvocation.args);
          } catch {
            return {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                args: JSON.stringify({}),
                parsedArgs: parsedArgs,
                status: ToolInvocationStatus.RESULT,
                result: { error: 'invalid_args', raw: part.toolInvocation.args }
              }
            };
          }
        }

        return {
          ...part,
          toolInvocation: {
            ...part.toolInvocation,
            args: part.toolInvocation.args,
            parsedArgs: parsedArgs,
            status: ToolInvocationStatus.RESULT,
            result: stub
          }
        };
      })
    };
  });
}
