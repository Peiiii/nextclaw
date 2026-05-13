import { randomUUID } from "node:crypto";
import { readNumber, readRecord, readString } from "./anthropic-openai-bridge-payload.utils.js";

type OpenAiStreamChunk = {
  choices?: Array<{
    delta?: Record<string, unknown>;
    finish_reason?: string | null;
  }>;
  usage?: {
    completion_tokens?: number;
  };
};

type TextBlockState = {
  index: number;
  text: string;
};

type ThinkingBlockState = {
  index: number;
  text: string;
};

type ToolUseBlockState = {
  index: number;
  id: string;
  name: string;
  inputJson: string;
};

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function writeSseEvent(
  response: { write: (chunk: string) => void },
  event: string,
  payload: Record<string, unknown>,
): void {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return readArray(content)
    .map((entry) => {
      const record = readRecord(entry);
      return readString(record?.text) ?? readString(record?.content) ?? "";
    })
    .join("");
}

function extractThinkingText(delta: Record<string, unknown> | undefined): string {
  return (
    readString(delta?.reasoning_content) ??
    readString(delta?.reasoning) ??
    readString(delta?.thinking) ??
    ""
  );
}

async function* readOpenAiSseChunks(upstreamResponse: Response): AsyncGenerator<OpenAiStreamChunk> {
  const stream = upstreamResponse.body;
  if (!stream) {
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const rawChunk of stream as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(rawChunk, { stream: true }).replaceAll("\r\n", "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();
      if (!data || data === "[DONE]") {
        continue;
      }
      yield JSON.parse(data) as OpenAiStreamChunk;
    }
  }
}

export function writeAnthropicStreamError(
  response: { writeHead: (statusCode: number, headers: Record<string, string>) => void; end: (chunk?: string) => void },
  message: string,
): void {
  response.writeHead(200, {
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "content-type": "text/event-stream; charset=utf-8",
  });
  response.end(
    `event: error\ndata: ${JSON.stringify({
      type: "error",
      error: { type: "api_error", message },
    })}\n\n`,
  );
}

export async function writeAnthropicOpenAiUpstreamStream(params: {
  response: {
    write: (chunk: string) => void;
    writeHead: (statusCode: number, headers: Record<string, string>) => void;
    end: () => void;
  };
  requestModel: string;
  upstreamResponse: Response;
}): Promise<void> {
  await new AnthropicOpenAiStreamWriter(params).write();
}

class AnthropicOpenAiStreamWriter {
  private readonly messageId = `msg_${randomUUID()}`;
  private readonly toolUses = new Map<number, ToolUseBlockState>();
  private textBlock: TextBlockState | null = null;
  private thinkingBlock: ThinkingBlockState | null = null;
  private nextBlockIndex = 0;
  private stopReason = "end_turn";
  private outputTokens = 0;

  constructor(
    private readonly params: {
      response: {
        write: (chunk: string) => void;
        writeHead: (statusCode: number, headers: Record<string, string>) => void;
        end: () => void;
      };
      requestModel: string;
      upstreamResponse: Response;
    },
  ) {}

  write = async (): Promise<void> => {
    this.writeHeaders();
    this.writeMessageStart();
    for await (const chunk of readOpenAiSseChunks(this.params.upstreamResponse)) {
      this.handleChunk(chunk);
    }
    this.stopContentBlocks();
    this.writeMessageStop();
    this.params.response.end();
  };

  private writeHeaders = (): void => {
    this.params.response.writeHead(200, {
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    });
  };

  private writeMessageStart = (): void => {
    writeSseEvent(this.params.response, "message_start", {
      type: "message_start",
      message: {
        id: this.messageId,
        type: "message",
        role: "assistant",
        model: this.params.requestModel,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    });
  };

  private ensureTextBlock = (): TextBlockState => {
    if (this.textBlock) {
      return this.textBlock;
    }
    this.textBlock = { index: this.nextBlockIndex, text: "" };
    this.nextBlockIndex += 1;
    writeSseEvent(this.params.response, "content_block_start", {
      type: "content_block_start",
      index: this.textBlock.index,
      content_block: { type: "text", text: "" },
    });
    return this.textBlock;
  };

  private ensureThinkingBlock = (): ThinkingBlockState => {
    if (this.thinkingBlock) {
      return this.thinkingBlock;
    }
    this.thinkingBlock = { index: this.nextBlockIndex, text: "" };
    this.nextBlockIndex += 1;
    writeSseEvent(this.params.response, "content_block_start", {
      type: "content_block_start",
      index: this.thinkingBlock.index,
      content_block: { type: "thinking", thinking: "" },
    });
    return this.thinkingBlock;
  };

  private ensureToolUse = (
    toolIndex: number,
    delta: Record<string, unknown>,
  ): ToolUseBlockState => {
    const existing = this.toolUses.get(toolIndex);
    if (existing) {
      return existing;
    }
    const fn = readRecord(delta.function);
    const state = {
      index: this.nextBlockIndex,
      id: readString(delta.id) ?? `tool_${toolIndex}`,
      name: readString(fn?.name) ?? "tool",
      inputJson: "",
    };
    this.nextBlockIndex += 1;
    this.toolUses.set(toolIndex, state);
    writeSseEvent(this.params.response, "content_block_start", {
      type: "content_block_start",
      index: state.index,
      content_block: { type: "tool_use", id: state.id, name: state.name, input: {} },
    });
    return state;
  };

  private handleChunk = (chunk: OpenAiStreamChunk): void => {
    this.outputTokens = Math.max(
      this.outputTokens,
      Math.trunc(readNumber(chunk.usage?.completion_tokens) ?? 0),
    );
    const choice = chunk.choices?.[0];
    this.stopReason = choice?.finish_reason === "tool_calls" ? "tool_use" : this.stopReason;
    this.stopReason = choice?.finish_reason === "length" ? "max_tokens" : this.stopReason;
    const delta = choice?.delta;
    this.writeThinkingDelta(extractThinkingText(delta));
    this.writeTextDelta(extractContentText(delta?.content));
    for (const rawToolCall of readArray(delta?.tool_calls)) {
      this.writeToolCallDelta(readRecord(rawToolCall));
    }
  };

  private writeThinkingDelta = (thinkingDelta: string): void => {
    if (!thinkingDelta) {
      return;
    }
    const state = this.ensureThinkingBlock();
    state.text += thinkingDelta;
    writeSseEvent(this.params.response, "content_block_delta", {
      type: "content_block_delta",
      index: state.index,
      delta: { type: "thinking_delta", thinking: thinkingDelta },
    });
  };

  private writeTextDelta = (textDelta: string): void => {
    if (!textDelta) {
      return;
    }
    const state = this.ensureTextBlock();
    state.text += textDelta;
    writeSseEvent(this.params.response, "content_block_delta", {
      type: "content_block_delta",
      index: state.index,
      delta: { type: "text_delta", text: textDelta },
    });
  };

  private writeToolCallDelta = (toolCall: Record<string, unknown> | undefined): void => {
    const toolIndex = Math.trunc(readNumber(toolCall?.index) ?? this.toolUses.size);
    const state = this.ensureToolUse(toolIndex, toolCall ?? {});
    const fn = readRecord(toolCall?.function);
    state.name = readString(fn?.name) ?? state.name;
    const argumentsDelta = readString(fn?.arguments) ?? "";
    state.inputJson += argumentsDelta;
    if (!argumentsDelta) {
      return;
    }
    writeSseEvent(this.params.response, "content_block_delta", {
      type: "content_block_delta",
      index: state.index,
      delta: { type: "input_json_delta", partial_json: argumentsDelta },
    });
  };

  private stopContentBlocks = (): void => {
    const completedBlocks: Array<ThinkingBlockState | TextBlockState | ToolUseBlockState> = [
      ...(this.thinkingBlock ? [this.thinkingBlock] : []),
      ...(this.textBlock ? [this.textBlock] : []),
      ...this.toolUses.values(),
    ];
    for (const block of completedBlocks) {
      writeSseEvent(this.params.response, "content_block_stop", {
        type: "content_block_stop",
        index: block.index,
      });
    }
  };

  private writeMessageStop = (): void => {
    writeSseEvent(this.params.response, "message_delta", {
      type: "message_delta",
      delta: { stop_reason: this.stopReason, stop_sequence: null },
      usage: { output_tokens: this.outputTokens },
    });
    writeSseEvent(this.params.response, "message_stop", {
      type: "message_stop",
    });
  };
}
