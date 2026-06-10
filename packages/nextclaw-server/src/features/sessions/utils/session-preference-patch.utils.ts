import { parseThinkingLevel } from "@nextclaw/core";
import type { SessionPatchUpdate } from "@nextclaw-server/shared/types/server-api.types.js";

export function applySessionPreferencePatch(params: {
  metadata: Record<string, unknown>;
  patch: SessionPatchUpdate;
  createInvalidThinkingError: (message: string) => Error;
}): Record<string, unknown> {
  const nextMetadata = params.metadata;
  const { patch } = params;

  if (Object.prototype.hasOwnProperty.call(patch, "label")) {
    const label = typeof patch.label === "string" ? patch.label.trim() : "";
    if (label) {
      nextMetadata.label = label;
    } else {
      delete nextMetadata.label;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "preferredModel")) {
    const preferredModel = typeof patch.preferredModel === "string" ? patch.preferredModel.trim() : "";
    if (preferredModel) {
      nextMetadata.preferred_model = preferredModel;
      nextMetadata.model = preferredModel;
    } else {
      delete nextMetadata.preferred_model;
      delete nextMetadata.model;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "preferredThinking")) {
    const preferredThinking = typeof patch.preferredThinking === "string" ? patch.preferredThinking.trim() : "";
    if (!preferredThinking) {
      delete nextMetadata.preferred_thinking;
    } else {
      const normalizedThinking = parseThinkingLevel(preferredThinking);
      if (!normalizedThinking) {
        throw params.createInvalidThinkingError("preferredThinking must be a supported thinking level");
      }
      nextMetadata.preferred_thinking = normalizedThinking;
    }
  }

  return nextMetadata;
}
