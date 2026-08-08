import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import type * as acp from "@agentclientprotocol/sdk";
import type {
  NcpMessage,
  NcpMessagePart,
  NcpProviderRuntimeRoute,
} from "@nextclaw/ncp";
import { readString } from "../stdio-runtime-config.utils.js";

export type AssetContentPathResolver = (assetUri: string) => string | null;

export function buildAcpPrompt(
  message: Pick<NcpMessage, "parts">,
  resolveAssetContentPath?: AssetContentPathResolver,
): acp.PromptRequest["prompt"] {
  const prompt: acp.PromptRequest["prompt"] = [];
  for (const part of message.parts) {
    if (part.type === "text" || part.type === "reasoning" || part.type === "rich-text") {
      if (part.text.length > 0) {
        prompt.push({ type: "text", text: part.text });
      }
      continue;
    }
    if (part.type === "file") {
      prompt.push(buildAcpResourceLink(part, resolveAssetContentPath));
    }
  }
  return prompt.length > 0 ? prompt : [{ type: "text", text: "[empty message]" }];
}

function buildAcpResourceLink(
  part: Extract<NcpMessagePart, { type: "file" }>,
  resolveAssetContentPath?: AssetContentPathResolver,
): Extract<acp.ContentBlock, { type: "resource_link" }> {
  return {
    type: "resource_link",
    name: readString(part.name) ?? "attachment",
    uri: resolveAttachmentUri(part, resolveAssetContentPath),
    mimeType: readString(part.mimeType),
    size:
      typeof part.sizeBytes === "number" && Number.isFinite(part.sizeBytes)
        ? part.sizeBytes
        : undefined,
  };
}

function resolveAttachmentUri(
  part: Extract<NcpMessagePart, { type: "file" }>,
  resolveAssetContentPath?: AssetContentPathResolver,
): string {
  const assetUri = readString(part.assetUri);
  if (assetUri) {
    const contentPath = resolveAssetContentPath
      ? readString(resolveAssetContentPath(assetUri))
      : undefined;
    if (!contentPath || !isAbsolute(contentPath)) {
      throw new Error(
        `[narp-stdio] cannot resolve attachment asset URI ${assetUri} to an absolute content path`,
      );
    }
    return pathToFileURL(contentPath).href;
  }

  const url = readString(part.url);
  if (url) {
    if (isAbsolute(url)) {
      return pathToFileURL(url).href;
    }
    try {
      return new URL(url).href;
    } catch {
      throw new Error(`[narp-stdio] attachment URL must be an absolute URI: ${url}`);
    }
  }

  if (readString(part.contentBase64)) {
    throw new Error(
      "[narp-stdio] inline attachment content is not supported by the ACP resource-link transport",
    );
  }
  throw new Error("[narp-stdio] attachment is missing a portable asset or URL reference");
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
