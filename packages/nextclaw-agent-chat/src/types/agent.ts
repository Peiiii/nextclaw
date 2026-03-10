import type { JSONSchema7 } from 'json-schema';
import type { Subscribable } from 'rxjs';
import type { AgentEvent } from './agent-event.js';
import type { ToolInvocation, UIMessage } from './ui-message.js';

export enum ToolInvocationStatus {
  CALL = 'call',
  RESULT = 'result',
  PARTIAL_CALL = 'partial-call',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult<RESULT = ToolExecutionResult> {
  toolCallId: string;
  result?: RESULT;
  status: ToolInvocationStatus;
  error?: string;
  cancelled?: boolean;
}

export type ToolExecutionResult = unknown;

export type ToolExecutor<ARGS = unknown, RESULT = ToolExecutionResult> = (
  toolCallArgs: ARGS,
  context?: Record<string, unknown>
) => RESULT | Promise<RESULT>;

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema7;
}

export interface ToolRenderer<ARGS = unknown, RESULT = ToolExecutionResult> {
  render: ToolRenderFn<ARGS, RESULT>;
  definition: ToolDefinition;
}

export type ToolRenderFn<ARGS = unknown, RESULT = ToolExecutionResult> = (
  tool: ToolInvocation<ARGS, RESULT>,
  onResult: (result: ToolResult<RESULT>) => void
) => unknown;

export interface Tool<ARGS = unknown, RESULT = ToolExecutionResult> extends ToolDefinition {
  execute?: ToolExecutor<ARGS, RESULT>;
  render?: ToolRenderFn<ARGS, RESULT>;
}

export interface Context {
  description: string;
  value: string;
}

export interface RunAgentInput {
  threadId?: string;
  runId?: string;
  messages: UIMessage[];
  tools?: Tool[];
  context?: Context[];
  metadata?: Record<string, unknown>;
}

export interface IAgent {
  run: (input: RunAgentInput) => Subscribable<AgentEvent>;
  abortRun?: () => void;
}
