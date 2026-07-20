import type { ServerResponse } from "node:http";
import {
  buildResponseResource,
  buildUsage,
} from "./codex-openai-responses-bridge-stream.utils.js";
import {
  nextSequenceNumber,
  readArray,
  readNumber,
  readRecord,
  readRawString,
  readString,
  writeSseEvent,
  type OpenResponsesOutputItem,
  type StreamSequenceState,
} from "@/codex-openai-responses-bridge-shared.utils.js";
import {
  extractContentText,
  extractReasoningText,
  readOpenAiSseChunks,
  type OpenAiStreamChunk,
} from "./codex-openai-sse-chunks.utils.js";

type TextStreamState = {
  outputIndex: number;
  itemId: string;
  text: string;
};

type ReasoningStreamState = {
  outputIndex: number;
  itemId: string;
  text: string;
};

type ToolCallStreamState = {
  outputIndex: number;
  itemId: string;
  callId: string;
  name: string;
  argumentsText: string;
};

export type CodexOpenAiResponsesOutputObserver = {
  onDone: () => void;
  onReasoningDelta: (delta: string) => void;
  onReasoningDone: () => void;
  onTextDelta: (delta: string) => void;
  onTextDone: () => void;
};

export async function writeResponsesUpstreamStream(params: {
  response: ServerResponse;
  responseId: string;
  model: string;
  outputObserver?: CodexOpenAiResponsesOutputObserver;
  upstreamResponse: Response;
}): Promise<void> {
  await new CodexResponsesOpenAiStreamWriter(params).write();
}

class CodexResponsesOpenAiStreamWriter {
  private readonly sequenceState: StreamSequenceState = { value: 0 };
  private readonly outputItems: OpenResponsesOutputItem[] = [];
  private readonly toolCalls = new Map<number, ToolCallStreamState>();
  private outputCount = 0;
  private textState: TextStreamState | null = null;
  private reasoningState: ReasoningStreamState | null = null;
  private usage: Record<string, unknown> = {};

  constructor(
    private readonly params: {
      response: ServerResponse;
      responseId: string;
      model: string;
      outputObserver?: CodexOpenAiResponsesOutputObserver;
      upstreamResponse: Response;
    },
  ) {}

  write = async (): Promise<void> => {
    this.writeHeaders();
    this.writeCreatedEvent();
    for await (const chunk of readOpenAiSseChunks(this.params.upstreamResponse)) {
      this.handleChunk(chunk);
    }
    this.finishReasoning();
    this.finishText();
    this.finishToolCalls();
    this.writeCompletedEvent();
    this.params.outputObserver?.onDone();
    this.params.response.end();
  };

  private nextOutputIndex = (): number => {
    const value = this.outputCount;
    this.outputCount += 1;
    return value;
  };

  private writeEvent = (eventType: string, payload: Record<string, unknown>): void => {
    writeSseEvent(this.params.response, eventType, {
      ...payload,
      sequence_number: nextSequenceNumber(this.sequenceState),
    });
  };

  private writeHeaders = (): void => {
    this.params.response.statusCode = 200;
    this.params.response.setHeader("content-type", "text/event-stream; charset=utf-8");
    this.params.response.setHeader("cache-control", "no-cache, no-transform");
    this.params.response.setHeader("connection", "keep-alive");
  };

  private writeCreatedEvent = (): void => {
    this.writeEvent("response.created", {
      type: "response.created",
      response: buildResponseResource({
        responseId: this.params.responseId,
        model: this.params.model,
        outputItems: [],
        usage: buildUsage({ usage: {} }),
        status: "in_progress",
      }),
    });
  };

  private ensureTextState = (): TextStreamState => {
    if (this.textState) {
      return this.textState;
    }
    this.textState = {
      outputIndex: this.nextOutputIndex(),
      itemId: `${this.params.responseId}:message:${this.outputCount}`,
      text: "",
    };
    this.writeEvent("response.output_item.added", {
      type: "response.output_item.added",
      output_index: this.textState.outputIndex,
      item: {
        type: "message",
        id: this.textState.itemId,
        role: "assistant",
        status: "in_progress",
        content: [],
      },
    });
    this.writeEvent("response.content_part.added", {
      type: "response.content_part.added",
      output_index: this.textState.outputIndex,
      item_id: this.textState.itemId,
      content_index: 0,
      part: { type: "output_text", text: "", annotations: [] },
    });
    return this.textState;
  };

  private ensureReasoningState = (): ReasoningStreamState => {
    if (this.reasoningState) {
      return this.reasoningState;
    }
    this.reasoningState = {
      outputIndex: this.nextOutputIndex(),
      itemId: `${this.params.responseId}:reasoning:${this.outputCount}`,
      text: "",
    };
    this.writeEvent("response.output_item.added", {
      type: "response.output_item.added",
      output_index: this.reasoningState.outputIndex,
      item: {
        type: "reasoning",
        id: this.reasoningState.itemId,
        status: "in_progress",
        content: [],
        summary: [],
      },
    });
    this.writeEvent("response.reasoning_summary_part.added", {
      type: "response.reasoning_summary_part.added",
      output_index: this.reasoningState.outputIndex,
      item_id: this.reasoningState.itemId,
      summary_index: 0,
      part: { type: "summary_text", text: "" },
    });
    return this.reasoningState;
  };

  private ensureToolCallState = (
    index: number,
    delta: Record<string, unknown>,
  ): ToolCallStreamState => {
    const existing = this.toolCalls.get(index);
    if (existing) {
      return existing;
    }
    const fn = readRecord(delta.function);
    const state = {
      outputIndex: this.nextOutputIndex(),
      itemId: `${this.params.responseId}:function:${this.outputCount}`,
      callId: readString(delta.id) ?? `${this.params.responseId}:call:${index}`,
      name: readString(fn?.name) ?? "tool",
      argumentsText: "",
    };
    this.toolCalls.set(index, state);
    this.writeEvent("response.output_item.added", {
      type: "response.output_item.added",
      output_index: state.outputIndex,
      item: {
        type: "function_call",
        id: state.itemId,
        call_id: state.callId,
        name: state.name,
        arguments: "",
        status: "in_progress",
      },
    });
    return state;
  };

  private handleChunk = (chunk: OpenAiStreamChunk): void => {
    this.usage = chunk.usage ?? this.usage;
    const delta = chunk.choices?.[0]?.delta;
    this.writeReasoningDelta(extractReasoningText(delta));
    this.writeTextDelta(extractContentText(delta?.content));
    for (const rawToolCall of readArray(delta?.tool_calls)) {
      this.writeToolCallDelta(readRecord(rawToolCall));
    }
  };

  private writeReasoningDelta = (reasoningDelta: string): void => {
    if (!reasoningDelta) {
      return;
    }
    const state = this.ensureReasoningState();
    state.text += reasoningDelta;
    this.params.outputObserver?.onReasoningDelta(reasoningDelta);
    this.writeEvent("response.reasoning_summary_text.delta", {
      type: "response.reasoning_summary_text.delta",
      output_index: state.outputIndex,
      item_id: state.itemId,
      summary_index: 0,
      delta: reasoningDelta,
    });
  };

  private writeTextDelta = (textDelta: string): void => {
    if (!textDelta) {
      return;
    }
    const state = this.ensureTextState();
    state.text += textDelta;
    this.params.outputObserver?.onTextDelta(textDelta);
    this.writeEvent("response.output_text.delta", {
      type: "response.output_text.delta",
      output_index: state.outputIndex,
      item_id: state.itemId,
      content_index: 0,
      delta: textDelta,
    });
  };

  private writeToolCallDelta = (toolCall: Record<string, unknown> | undefined): void => {
    const toolIndex = Math.trunc(readNumber(toolCall?.index) ?? this.toolCalls.size);
    const fn = readRecord(toolCall?.function);
    const state = this.ensureToolCallState(toolIndex, toolCall ?? {});
    state.name = readString(fn?.name) ?? state.name;
    const argumentsDelta = readRawString(fn?.arguments) ?? "";
    state.argumentsText += argumentsDelta;
    if (!argumentsDelta) {
      return;
    }
    this.writeEvent("response.function_call_arguments.delta", {
      type: "response.function_call_arguments.delta",
      output_index: state.outputIndex,
      item_id: state.itemId,
      delta: argumentsDelta,
    });
  };

  private finishReasoning = (): void => {
    if (!this.reasoningState) {
      return;
    }
    const item = {
      type: "reasoning",
      id: this.reasoningState.itemId,
      summary: [{ type: "summary_text", text: this.reasoningState.text }],
      content: [],
      status: "completed",
    };
    this.outputItems[this.reasoningState.outputIndex] = item;
    this.writeEvent("response.reasoning_summary_text.done", {
      type: "response.reasoning_summary_text.done",
      output_index: this.reasoningState.outputIndex,
      item_id: this.reasoningState.itemId,
      summary_index: 0,
      text: this.reasoningState.text,
    });
    this.writeEvent("response.reasoning_summary_part.done", {
      type: "response.reasoning_summary_part.done",
      output_index: this.reasoningState.outputIndex,
      item_id: this.reasoningState.itemId,
      summary_index: 0,
      part: { type: "summary_text", text: this.reasoningState.text },
    });
    this.writeEvent("response.output_item.done", {
      type: "response.output_item.done",
      output_index: this.reasoningState.outputIndex,
      item,
    });
    this.params.outputObserver?.onReasoningDone();
  };

  private finishText = (): void => {
    if (!this.textState) {
      return;
    }
    const item = {
      type: "message",
      id: this.textState.itemId,
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: this.textState.text, annotations: [] }],
    };
    this.outputItems[this.textState.outputIndex] = item;
    this.writeEvent("response.output_text.done", {
      type: "response.output_text.done",
      output_index: this.textState.outputIndex,
      item_id: this.textState.itemId,
      content_index: 0,
      text: this.textState.text,
    });
    this.writeEvent("response.content_part.done", {
      type: "response.content_part.done",
      output_index: this.textState.outputIndex,
      item_id: this.textState.itemId,
      content_index: 0,
      part: { type: "output_text", text: this.textState.text, annotations: [] },
    });
    this.writeEvent("response.output_item.done", {
      type: "response.output_item.done",
      output_index: this.textState.outputIndex,
      item,
    });
    this.params.outputObserver?.onTextDone();
  };

  private finishToolCalls = (): void => {
    for (const state of [...this.toolCalls.values()].sort((a, b) => a.outputIndex - b.outputIndex)) {
      const item = {
        type: "function_call",
        id: state.itemId,
        call_id: state.callId,
        name: state.name,
        arguments: state.argumentsText,
        status: "completed",
      };
      this.outputItems[state.outputIndex] = item;
      this.writeEvent("response.function_call_arguments.done", {
        type: "response.function_call_arguments.done",
        output_index: state.outputIndex,
        item_id: state.itemId,
        arguments: state.argumentsText,
      });
      this.writeEvent("response.output_item.done", {
        type: "response.output_item.done",
        output_index: state.outputIndex,
        item,
      });
    }
  };

  private writeCompletedEvent = (): void => {
    this.writeEvent("response.completed", {
      type: "response.completed",
      response: buildResponseResource({
        responseId: this.params.responseId,
        model: this.params.model,
        outputItems: this.outputItems.filter(Boolean),
        usage: buildUsage({ usage: this.usage }),
      }),
    });
  };
}
