import type { NcpProviderRuntimeRoute } from "@nextclaw/ncp";
import { readString } from "../stdio-runtime-config.utils.js";

export function extractPromptText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  const text = (message.parts ?? [])
    .map((part) => {
      if (part.type === "text" || part.type === "reasoning" || part.type === "rich-text") {
        return part.text ?? "";
      }
      return "";
    })
    .join("\n")
    .trim();
  return text.length > 0 ? text : "[empty message]";
}

export function resolveModelId(params: {
  providerRoute?: NcpProviderRuntimeRoute;
  metadata?: Record<string, unknown>;
}): string | undefined {
  const { metadata, providerRoute } = params;
  const modelId =
    providerRoute?.model ??
    readString(metadata?.preferred_model) ??
    readString(metadata?.preferredModel) ??
    readString(metadata?.model);
  return modelId === "__nextclaw_runtime_default__" ? undefined : modelId;
}
