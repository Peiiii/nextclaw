import type { ThinkingLevel } from "@core/shared/lib/core-utils/index.js";

export function buildChatCompletionsThinking(params: {
  control?: "thinking-type";
  model: string;
  thinkingLevel: ThinkingLevel | null | undefined;
}): Record<string, unknown> {
  const usesThinkingTypeControl = params.control === "thinking-type"
    || params.model.trim().toLowerCase() === "minimax-m3";
  return usesThinkingTypeControl && params.thinkingLevel === "off"
    ? { thinking: { type: "disabled" } }
    : {};
}
