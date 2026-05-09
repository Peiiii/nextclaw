import {
  normalizeAssistantText,
  type NcpAssistantReasoningNormalizationMode,
  type OpenAIChatChunk,
} from "@nextclaw/ncp";
import { applyToolDelta, getToolCallIndex, type DeltaLike, type ToolCallBuffer } from "./stream-encoder.utils.js";

export type CollectedToolCall = {
  toolCallId: string;
  toolName: string;
  args: string;
};

export class DefaultNcpRoundCollector {
  private rawText = "";
  private explicitReasoning = "";
  private readonly toolCallBuffers = new Map<number, ToolCallBuffer>();

  constructor(
    private readonly reasoningNormalizationMode: NcpAssistantReasoningNormalizationMode = "off",
  ) {}

  clear(): void {
    this.rawText = "";
    this.explicitReasoning = "";
    this.toolCallBuffers.clear();
  }

  consumeChunk(chunk: OpenAIChatChunk): void {
    const choice = chunk.choices?.[0];
    if (!choice) {
      return;
    }

    const delta = choice.delta as DeltaLike | undefined;
    if (!delta) {
      return;
    }

    if (typeof delta.content === "string" && delta.content.length > 0) {
      this.rawText += delta.content;
    }

    const reasoning = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoning === "string" && reasoning.length > 0) {
      this.explicitReasoning += reasoning;
    }

    const toolDeltas = delta.tool_calls;
    if (!Array.isArray(toolDeltas)) {
      return;
    }

    for (const toolDelta of toolDeltas) {
      const index = getToolCallIndex(toolDelta, this.toolCallBuffers.size);
      const previous = this.toolCallBuffers.get(index) ?? { argumentsText: "" };
      const current = applyToolDelta(previous, toolDelta);
      this.toolCallBuffers.set(index, current);
    }
  }

  getText(): string {
    if (this.reasoningNormalizationMode !== "think-tags") {
      return this.rawText;
    }
    return normalizeAssistantText(this.rawText, this.reasoningNormalizationMode).text;
  }

  getReasoning(): string {
    if (this.explicitReasoning.length > 0) {
      return this.explicitReasoning;
    }
    if (this.reasoningNormalizationMode !== "think-tags") {
      return "";
    }
    return normalizeAssistantText(this.rawText, this.reasoningNormalizationMode).reasoning;
  }

  getToolCalls(): CollectedToolCall[] {
    const orderedEntries = Array.from(this.toolCallBuffers.entries()).sort(([left], [right]) => left - right);
    const toolCalls: CollectedToolCall[] = [];

    for (const [, buffer] of orderedEntries) {
      if (!buffer.id || !buffer.name) {
        continue;
      }
      toolCalls.push({
        toolCallId: buffer.id,
        toolName: buffer.name,
        args: buffer.argumentsText,
      });
    }

    return toolCalls;
  }
}
