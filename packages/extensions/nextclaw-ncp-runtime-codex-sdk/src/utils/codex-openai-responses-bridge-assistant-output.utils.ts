import type { ServerResponse } from "node:http";
import { normalizeAssistantText } from "@nextclaw/ncp";
import {
  nextSequenceNumber,
  readArray,
  readRecord,
  readRawString,
  readString,
  writeSseEvent,
  type OpenAiChatCompletionChoiceMessage,
  type OpenResponsesOutputItem,
  type StreamSequenceState,
} from "@/codex-openai-responses-bridge-shared.utils.js";

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

type ReasoningExtraction = {
  present: boolean;
  text: string;
};

function readReasoningRecordText(value: unknown): string {
  const record = readRecord(value);
  if (!record) {
    return "";
  }
  return (
    readRawString(record.text) ??
    readRawString(record.content) ??
    readRawString(record.reasoning) ??
    readRawString(record.reasoning_content) ??
    readRawString(record.thinking) ??
    ""
  );
}

function extractReasoningDetailsText(value: unknown): ReasoningExtraction | undefined {
  const rawString = readRawString(value);
  if (rawString !== undefined) {
    return {
      present: true,
      text: rawString,
    };
  }

  const record = readRecord(value);
  if (record) {
    return {
      present: true,
      text: readReasoningRecordText(record),
    };
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const text = readArray(value)
    .map((entry) => readReasoningRecordText(entry))
    .join("");
  return {
    present: true,
    text,
  };
}

function extractContentReasoningText(content: unknown): string {
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
      if (
        type === "reasoning" ||
        type === "reasoning_text" ||
        type === "thinking" ||
        type === "thinking_text"
      ) {
        return readReasoningRecordText(record);
      }
      return "";
    })
    .join("");
}

function extractExplicitReasoning(
  message: OpenAiChatCompletionChoiceMessage | undefined,
): ReasoningExtraction | undefined {
  const candidates = [
    message?.reasoning_content,
    message?.reasoning,
    message?.thinking,
    message?.reasoning_details,
  ];

  for (const candidate of candidates) {
    const extracted = extractReasoningDetailsText(candidate);
    if (extracted) {
      return extracted;
    }
  }

  const contentReasoning = extractContentReasoningText(message?.content);
  return contentReasoning
    ? {
        present: true,
        text: contentReasoning,
      }
    : undefined;
}

function extractAssistantOutput(message: OpenAiChatCompletionChoiceMessage | undefined): {
  text: string;
  reasoning: string;
  reasoningPresent: boolean;
} {
  const rawText = extractAssistantText(message?.content);
  const normalized = normalizeAssistantText(rawText, "think-tags");
  const explicitReasoning = extractExplicitReasoning(message);
  const reasoning = explicitReasoning?.text ?? readString(normalized.reasoning) ?? "";
  const reasoningPresent = explicitReasoning?.present === true || Boolean(normalized.reasoning);
  const text =
    explicitReasoning?.present === true
      ? readString(normalized.text) ?? readString(rawText) ?? ""
      : normalized.reasoning
        ? readString(normalized.text) ?? ""
        : readString(rawText) ?? "";

  return {
    text,
    reasoning,
    reasoningPresent,
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
  const { reasoning, reasoningPresent, text } = extractAssistantOutput(params.message);
  const outputItems: OpenResponsesOutputItem[] = [];

  if (reasoningPresent) {
    outputItems.push({
      type: "reasoning",
      id: `${params.responseId}:reasoning:0`,
      summary: [
        {
          type: "summary_text",
          text: reasoning,
        },
      ],
      content: [],
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
  const { item, outputIndex, response, sequenceState } = params;
  const itemId = readString(item.id);
  const summary = readArray(item.summary);
  const summaryIndex = summary.findIndex((entry) => readString(readRecord(entry)?.type) === "summary_text");
  const summaryText =
    summaryIndex >= 0 ? readString(readRecord(summary[summaryIndex])?.text) ?? "" : "";

  writeSseEvent(response, "response.output_item.added", {
    type: "response.output_item.added",
    sequence_number: nextSequenceNumber(sequenceState),
    output_index: outputIndex,
    item: buildInProgressReasoningItem(item),
  });

  if (itemId && summaryText) {
    writeSseEvent(response, "response.reasoning_summary_part.added", {
      type: "response.reasoning_summary_part.added",
      sequence_number: nextSequenceNumber(sequenceState),
      output_index: outputIndex,
      item_id: itemId,
      summary_index: summaryIndex,
      part: {
        type: "summary_text",
        text: "",
      },
    });
    writeSseEvent(response, "response.reasoning_summary_text.delta", {
      type: "response.reasoning_summary_text.delta",
      sequence_number: nextSequenceNumber(sequenceState),
      output_index: outputIndex,
      item_id: itemId,
      summary_index: summaryIndex,
      delta: summaryText,
    });
    writeSseEvent(response, "response.reasoning_summary_text.done", {
      type: "response.reasoning_summary_text.done",
      sequence_number: nextSequenceNumber(sequenceState),
      output_index: outputIndex,
      item_id: itemId,
      summary_index: summaryIndex,
      text: summaryText,
    });
    writeSseEvent(response, "response.reasoning_summary_part.done", {
      type: "response.reasoning_summary_part.done",
      sequence_number: nextSequenceNumber(sequenceState),
      output_index: outputIndex,
      item_id: itemId,
      summary_index: summaryIndex,
      part: {
        type: "summary_text",
        text: summaryText,
      },
    });
  }

  writeSseEvent(response, "response.output_item.done", {
    type: "response.output_item.done",
    sequence_number: nextSequenceNumber(sequenceState),
    output_index: outputIndex,
    item,
  });
}
