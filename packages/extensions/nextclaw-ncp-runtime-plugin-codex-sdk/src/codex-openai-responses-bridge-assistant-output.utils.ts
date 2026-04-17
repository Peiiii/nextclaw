import type { ServerResponse } from "node:http";
import { normalizeAssistantText } from "@nextclaw/ncp";
import {
  nextSequenceNumber,
  readArray,
  readRecord,
  readString,
  writeSseEvent,
  type OpenAiChatCompletionChoiceMessage,
  type OpenResponsesOutputItem,
  type StreamSequenceState,
} from "./codex-openai-responses-bridge-shared.utils.js";

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((entry) => {
      const record = readRecord(entry);
      if (!record) {
        return "";
      }
      const type = readString(record.type);
      if (type === "text" || type === "output_text") {
        return readString(record.text) ?? "";
      }
      return "";
    })
    .filter(Boolean)
    .join("");
}

function extractAssistantOutput(message: OpenAiChatCompletionChoiceMessage | undefined): {
  text: string;
  reasoning: string;
} {
  const rawText = extractAssistantText(message?.content);
  const normalized = normalizeAssistantText(rawText, "think-tags");
  const explicitReasoning = readString(message?.reasoning_content);
  const reasoning = explicitReasoning ?? readString(normalized.reasoning) ?? "";
  const text =
    explicitReasoning
      ? readString(normalized.text) ?? readString(rawText) ?? ""
      : normalized.reasoning
        ? readString(normalized.text) ?? ""
        : readString(rawText) ?? "";

  return {
    text,
    reasoning,
  };
}

function buildInProgressReasoningItem(item: OpenResponsesOutputItem): OpenResponsesOutputItem {
  return {
    ...structuredClone(item),
    status: "in_progress",
    content: [],
    summary: [],
  };
}

export function buildAssistantOutputItems(params: {
  message: OpenAiChatCompletionChoiceMessage | undefined;
  responseId: string;
}): OpenResponsesOutputItem[] {
  const { text, reasoning } = extractAssistantOutput(params.message);
  const outputItems: OpenResponsesOutputItem[] = [];

  if (reasoning) {
    outputItems.push({
      type: "reasoning",
      id: `${params.responseId}:reasoning:0`,
      summary: [],
      content: [
        {
          type: "reasoning_text",
          text: reasoning,
        },
      ],
      status: "completed",
    });
  }

  if (text) {
    outputItems.push({
      type: "message",
      id: `${params.responseId}:message:${outputItems.length}`,
      role: "assistant",
      status: "completed",
      content: [
        {
          type: "output_text",
          text,
          annotations: [],
        },
      ],
    });
  }

  return outputItems;
}

export function writeReasoningOutputItemEvents(params: {
  response: ServerResponse;
  item: OpenResponsesOutputItem;
  outputIndex: number;
  sequenceState: StreamSequenceState;
}): void {
  const itemId = readString(params.item.id);
  const content = readArray(params.item.content);
  const textPart = content.find((entry) => readString(readRecord(entry)?.type) === "reasoning_text");
  const text = readString(readRecord(textPart)?.text) ?? "";

  writeSseEvent(params.response, "response.output_item.added", {
    type: "response.output_item.added",
    sequence_number: nextSequenceNumber(params.sequenceState),
    output_index: params.outputIndex,
    item: buildInProgressReasoningItem(params.item),
  });

  if (itemId && text) {
    writeSseEvent(params.response, "response.reasoning_text.delta", {
      type: "response.reasoning_text.delta",
      sequence_number: nextSequenceNumber(params.sequenceState),
      output_index: params.outputIndex,
      item_id: itemId,
      content_index: 0,
      delta: text,
    });
  }

  if (itemId) {
    writeSseEvent(params.response, "response.reasoning_text.done", {
      type: "response.reasoning_text.done",
      sequence_number: nextSequenceNumber(params.sequenceState),
      output_index: params.outputIndex,
      item_id: itemId,
      content_index: 0,
      text,
    });
  }

  writeSseEvent(params.response, "response.output_item.done", {
    type: "response.output_item.done",
    sequence_number: nextSequenceNumber(params.sequenceState),
    output_index: params.outputIndex,
    item: params.item,
  });
}
