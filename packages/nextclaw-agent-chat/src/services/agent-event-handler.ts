import { v4 } from 'uuid';
import {
  EventType,
  ToolInvocationStatus,
  type AgentEvent,
  type TextDeltaEvent,
  type TextStartEvent,
  type ToolCallArgsDeltaEvent,
  type ToolCallArgsEvent,
  type ToolCallStartEvent,
  type ToolCallResultEvent,
  type ReasoningStartEvent,
  type ReasoningDeltaEvent
} from '../types/index.js';
import type { ToolInvocationUIPart, UIMessage } from '../types/ui-message.js';
import { toolCallToToolInvocation } from '../utils/index.js';
import type { AgentChatController } from './agent-chat-controller.js';

export class AgentEventHandler {
  private currentMessageId?: string;
  private currentReasoningMessageId?: string;
  private currentReasoningContent: string = '';
  private currentToolCallId?: string;
  private currentToolCallMessageId?: string;
  private currentToolCallName?: string;
  private currentToolCallArgs: string = '';
  private emittedToolCallIds = new Set<string>();

  constructor(private readonly sessionManager: AgentChatController) {}

  private findAssistantMessageById(messageId?: string): UIMessage | null {
    const targetId = messageId?.trim();
    if (!targetId) {
      return null;
    }
    const currentMessages = this.sessionManager.getMessages();
    return currentMessages.find((message) => message.role === 'assistant' && message.id === targetId) ?? null;
  }

  private findAssistantMessageByToolCallId(toolCallId: string): UIMessage | null {
    if (!toolCallId) {
      return null;
    }
    const currentMessages = this.sessionManager.getMessages();
    for (let i = currentMessages.length - 1; i >= 0; i -= 1) {
      const message = currentMessages[i];
      if (message.role !== 'assistant') {
        continue;
      }
      const hasTargetTool = message.parts?.some(
        (part) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId
      );
      if (hasTargetTool) {
        return message;
      }
    }
    return null;
  }

  private findAssistantMessageForCurrentTool(toolCallId: string): UIMessage | null {
    const exactMessage = this.findAssistantMessageById(this.currentToolCallMessageId);
    if (exactMessage?.parts?.some((part) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId)) {
      return exactMessage;
    }
    return this.findAssistantMessageByToolCallId(toolCallId);
  }

  reset() {
    this.currentMessageId = undefined;
    this.currentReasoningMessageId = undefined;
    this.currentReasoningContent = '';
    this.currentToolCallId = undefined;
    this.currentToolCallMessageId = undefined;
    this.currentToolCallName = undefined;
    this.currentToolCallArgs = '';
    this.emittedToolCallIds.clear();
  }

  private emitToolCallEvents() {
    const currentMessages = this.sessionManager.getMessages();
    for (const message of currentMessages) {
      if (message.role !== 'assistant' || !message.parts) {
        continue;
      }
      for (const part of message.parts) {
        if (part.type !== 'tool-invocation') continue;
        const inv = part.toolInvocation;
        if (inv.status === ToolInvocationStatus.CALL && !this.emittedToolCallIds.has(inv.toolCallId)) {
          this.emittedToolCallIds.add(inv.toolCallId);
          this.sessionManager.toolCall$.next({
            toolCall: {
              id: inv.toolCallId,
              type: 'function',
              function: {
                name: inv.toolName,
                arguments: inv.args
              }
            }
          });
        }
      }
    }
  }

  handleEvent(event: AgentEvent) {
    switch (event.type) {
      case EventType.RUN_STARTED:
        break;
      case EventType.TEXT_START:
        this.handleTextStart(event as TextStartEvent);
        break;
      case EventType.TEXT_DELTA:
        this.handleTextContent(event as TextDeltaEvent);
        break;
      case EventType.TEXT_END:
        this.handleTextEnd();
        break;
      case EventType.REASONING_START:
        this.handleReasoningStart(event as ReasoningStartEvent);
        break;
      case EventType.REASONING_DELTA:
        this.handleReasoningContent(event as ReasoningDeltaEvent);
        break;
      case EventType.REASONING_END:
        this.handleReasoningEnd();
        break;
      case EventType.TOOL_CALL_START:
        this.handleToolCallStart(event as ToolCallStartEvent);
        break;
      case EventType.TOOL_CALL_ARGS_DELTA:
        this.handleToolCallArgsDelta(event as ToolCallArgsDeltaEvent);
        break;
      case EventType.TOOL_CALL_ARGS:
        this.handleToolCallArgs(event as ToolCallArgsEvent);
        break;
      case EventType.TOOL_CALL_END:
        this.handleToolCallEnd();
        this.emitToolCallEvents();
        break;
      case EventType.TOOL_CALL_RESULT:
        this.handleToolCallResult(event as ToolCallResultEvent);
        break;
      default:
        break;
    }
  }

  private handleTextStart(event: TextStartEvent) {
    this.currentMessageId = event.messageId;
  }

  private appendTextDelta(message: UIMessage, delta: string) {
    const parts = [...(message.parts || [])];
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.type === 'text') {
      return {
        ...message,
        parts: [
          ...parts.slice(0, -1),
          { type: 'text' as const, text: `${lastPart.text}${delta}` }
        ]
      };
    }
    return {
      ...message,
      parts: [...parts, { type: 'text' as const, text: delta }]
    };
  }

  private handleTextContent(event: TextDeltaEvent) {
    if (!event.delta || this.currentMessageId !== event.messageId) return;

    const currentMessages = this.sessionManager.getMessages();
    const existingMessage = currentMessages.find(
      (message) => message.role === 'assistant' && message.id === this.currentMessageId
    );

    if (existingMessage) {
      this.sessionManager.updateMessage(this.appendTextDelta(existingMessage, event.delta));
    } else {
      this.sessionManager.addMessages([
        {
          id: this.currentMessageId!,
          role: 'assistant' as const,
          parts: [
            {
              type: 'text' as const,
              text: event.delta
            }
          ]
        }
      ]);
    }
  }

  private handleTextEnd() {
    this.currentMessageId = undefined;
  }

  private updateReasoningPart(message: UIMessage, reasoning: string) {
    const parts = [...(message.parts || [])];
    let reasoningPartIndex = -1;
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      if (parts[index]?.type === 'reasoning') {
        reasoningPartIndex = index;
        break;
      }
    }
    if (reasoningPartIndex >= 0) {
      return {
        ...message,
        parts: [
          ...parts.slice(0, reasoningPartIndex),
          { type: 'reasoning' as const, reasoning, details: [] },
          ...parts.slice(reasoningPartIndex + 1)
        ]
      };
    }
    return {
      ...message,
      parts: [...parts, { type: 'reasoning' as const, reasoning, details: [] }]
    };
  }

  private handleReasoningStart(event: ReasoningStartEvent) {
    this.currentReasoningMessageId = event.messageId;
    this.currentReasoningContent = '';
  }

  private handleReasoningContent(event: ReasoningDeltaEvent) {
    if (!event.delta || this.currentReasoningMessageId !== event.messageId) return;

    this.currentReasoningContent += event.delta;
    const reasoningContent = this.currentReasoningContent;
    const messageId = this.currentReasoningMessageId;

    const currentMessages = this.sessionManager.getMessages();
    const existingMessage = currentMessages.find((message) => message.role === 'assistant' && message.id === messageId);

    if (existingMessage) {
      this.sessionManager.updateMessage(this.updateReasoningPart(existingMessage, reasoningContent));
    } else {
      this.sessionManager.addMessages([
        {
          id: messageId!,
          role: 'assistant' as const,
          parts: [
            {
              type: 'reasoning' as const,
              reasoning: reasoningContent,
              details: []
            }
          ]
        }
      ]);
    }
  }

  private handleReasoningEnd() {
    this.currentReasoningMessageId = undefined;
    this.currentReasoningContent = '';
  }

  private handleToolCallStart(event: ToolCallStartEvent) {
    this.currentToolCallId = event.toolCallId;
    this.currentToolCallName = event.toolName;
    this.currentToolCallArgs = '';
    this.currentToolCallMessageId = event.messageId;

    const invocationPart: ToolInvocationUIPart = {
      type: 'tool-invocation' as const,
      toolInvocation: {
        status: ToolInvocationStatus.PARTIAL_CALL,
        toolCallId: this.currentToolCallId,
        toolName: this.currentToolCallName,
        args: ''
      }
    };

    const currentMessages = this.sessionManager.getMessages();
    const messageId = event.messageId?.trim();
    const exactMessage = this.findAssistantMessageById(messageId);

    if (exactMessage) {
      this.currentToolCallMessageId = exactMessage.id;
      const existingPart = exactMessage.parts.find(
        (part) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === this.currentToolCallId
      );
      if (existingPart && existingPart.type === 'tool-invocation') {
        this.currentToolCallArgs = existingPart.toolInvocation.args;
        return;
      }
      this.sessionManager.updateMessage({
        ...exactMessage,
        parts: [...(exactMessage.parts || []), invocationPart]
      });
      return;
    }

    if (messageId) {
      this.currentToolCallMessageId = messageId;
      this.sessionManager.addMessages([
        {
          id: messageId,
          role: 'assistant',
          parts: [invocationPart]
        }
      ]);
      return;
    }

    const existingMessage = this.findAssistantMessageByToolCallId(this.currentToolCallId);
    if (existingMessage) {
      this.currentToolCallMessageId = existingMessage.id;
      const existingPart = existingMessage.parts.find(
        (part) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === this.currentToolCallId
      );
      this.currentToolCallArgs = existingPart?.type === 'tool-invocation' ? existingPart.toolInvocation.args : '';
      return;
    }

    const lastMessage = currentMessages[currentMessages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      this.currentToolCallMessageId = lastMessage.id;
      this.sessionManager.updateMessage({
        ...lastMessage,
        parts: [...(lastMessage.parts || []), invocationPart]
      });
    } else {
      const fallbackMessageId = v4();
      this.currentToolCallMessageId = fallbackMessageId;
      this.sessionManager.addMessages([
        {
          id: fallbackMessageId,
          role: 'assistant',
          parts: [invocationPart]
        }
      ]);
    }
  }

  private handleToolCallArgsDelta(event: ToolCallArgsDeltaEvent) {
    if (this.currentToolCallId !== event.toolCallId) return;
    this.currentToolCallArgs += event.argsDelta;

    const targetMessage = this.findAssistantMessageForCurrentTool(event.toolCallId);
    if (!targetMessage || targetMessage.role !== 'assistant' || !targetMessage.parts?.length) return;

    const updatedParts = [...targetMessage.parts];
    for (let i = updatedParts.length - 1; i >= 0; i--) {
      const part = updatedParts[i];
      if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === event.toolCallId) {
        let parsed;
        try {
          parsed = JSON.parse(this.currentToolCallArgs);
        } catch {
          // keep raw string
        }
        updatedParts[i] = {
          ...part,
          toolInvocation: {
            ...part.toolInvocation,
            status: ToolInvocationStatus.PARTIAL_CALL,
            args: this.currentToolCallArgs,
            parsedArgs: parsed
          }
        };
        break;
      }
    }

    this.sessionManager.updateMessage({
      ...targetMessage,
      parts: updatedParts
    });
  }

  private handleToolCallArgs(event: ToolCallArgsEvent) {
    if (this.currentToolCallId !== event.toolCallId) return;
    this.currentToolCallArgs = event.args;
    this.handleToolCallArgsDelta({
      type: EventType.TOOL_CALL_ARGS_DELTA,
      toolCallId: event.toolCallId,
      argsDelta: ''
    });
  }

  private handleToolCallEnd() {
    if (!this.currentToolCallId || !this.currentToolCallName) return;

    try {
      const toolCall = {
        id: this.currentToolCallId,
        type: 'function' as const,
        function: {
          name: this.currentToolCallName,
          arguments: this.currentToolCallArgs
        }
      };

      const targetMessage = this.findAssistantMessageForCurrentTool(this.currentToolCallId);

      if (targetMessage && targetMessage.role === 'assistant') {
        const updatedParts = [...(targetMessage.parts || [])];
        for (let i = updatedParts.length - 1; i >= 0; i--) {
          const part = updatedParts[i];
          if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === this.currentToolCallId) {
            updatedParts[i] = {
              ...part,
              toolInvocation: {
                ...toolCallToToolInvocation(toolCall),
                status: ToolInvocationStatus.CALL
              }
            };
            break;
          }
        }
        this.sessionManager.updateMessage({
          ...targetMessage,
          parts: updatedParts
        });
      } else {
        const fallbackMessageId = this.currentToolCallMessageId?.trim() || v4();
        this.sessionManager.addMessages([
          {
            id: fallbackMessageId,
            role: 'assistant',
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  ...toolCallToToolInvocation(toolCall),
                  status: ToolInvocationStatus.CALL
                }
              }
            ]
          }
        ]);
      }
    } catch {
      // ignore parse errors
    }

    this.currentToolCallId = undefined;
    this.currentToolCallMessageId = undefined;
    this.currentToolCallName = undefined;
    this.currentToolCallArgs = '';
  }

  private handleToolCallResult(event: ToolCallResultEvent) {
    this.sessionManager.addToolResult({
      toolCallId: event.toolCallId,
      result: event.content,
      status: ToolInvocationStatus.RESULT
    });
  }
}
