import { readNumber, readRecord, readString } from "./anthropic-openai-bridge-payload.js";

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function writeSseEvent(response: { write: (chunk: string) => void }, event: string, payload: Record<string, unknown>) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function writeAnthropicMessageStream(
  response: { write: (chunk: string) => void },
  message: Record<string, unknown>,
): void {
  const content = readArray(message.content);
  const usage = readRecord(message.usage) ?? {};

  writeSseEvent(response, "message_start", {
    type: "message_start",
    message: {
      ...message,
      content: [],
      stop_reason: null,
      stop_sequence: null,
    },
  });

  content.forEach((entry, index) => {
    const block = readRecord(entry);
    const blockType = readString(block?.type);
    if (!block || !blockType) {
      return;
    }

    writeSseEvent(response, "content_block_start", {
      type: "content_block_start",
      index,
      content_block:
        blockType === "tool_use"
          ? {
              type: "tool_use",
              id: readString(block.id) ?? `tool_${index}`,
              name: readString(block.name) ?? "tool",
              input: {},
            }
          : {
              type: "text",
              text: "",
            },
    });

    writeSseEvent(response, "content_block_delta", {
      type: "content_block_delta",
      index,
      delta:
        blockType === "tool_use"
          ? {
              type: "input_json_delta",
              partial_json: JSON.stringify(readRecord(block.input) ?? {}),
            }
          : {
              type: "text_delta",
              text: readString(block.text) ?? "",
            },
    });

    writeSseEvent(response, "content_block_stop", {
      type: "content_block_stop",
      index,
    });
  });

  writeSseEvent(response, "message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: readString(message.stop_reason) ?? "end_turn",
      stop_sequence: null,
    },
    usage: {
      output_tokens: Math.max(0, Math.trunc(readNumber(usage.output_tokens) ?? 0)),
    },
  });
  writeSseEvent(response, "message_stop", {
    type: "message_stop",
  });
}
