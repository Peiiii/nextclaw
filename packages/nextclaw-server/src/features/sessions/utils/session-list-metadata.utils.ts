import { parseThinkingLevel, type ThinkingLevel } from "@nextclaw/core";

export function readSessionListMetadata(metadata: Record<string, unknown>): {
  label?: string;
  preferredModel?: string;
  preferredThinking?: ThinkingLevel | null;
} {
  const rawLabel = typeof metadata.label === "string" ? metadata.label.trim() : "";
  const rawPreferredModel =
    typeof metadata.preferred_model === "string" ? metadata.preferred_model.trim() : "";

  return {
    label: rawLabel || undefined,
    preferredModel: rawPreferredModel || undefined,
    preferredThinking: parseThinkingLevel(metadata.preferred_thinking) ?? null
  };
}
