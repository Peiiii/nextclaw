import type { Tool, ToolCall, ToolDefinition } from '../types/agent.js';
import type { ToolInvocation } from '../types/ui-message.js';

export const getToolDefFromTool = (tool: Tool): ToolDefinition => {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  };
};

export const toolInvocationToToolCall = (toolInvocation: ToolInvocation): ToolCall => {
  return {
    id: toolInvocation.toolCallId,
    type: 'function',
    function: {
      name: toolInvocation.toolName,
      arguments: JSON.stringify(toolInvocation.args)
    }
  };
};
