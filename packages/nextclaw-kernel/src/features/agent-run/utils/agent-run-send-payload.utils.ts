import type { InboundAttachment } from "@nextclaw/core";
import type { NcpMessagePart } from "@nextclaw/ncp";
import type { AgentRunSendIngressPayload } from "@nextclaw/shared";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export type AssetApi = {
  putBytes: (input: {
    fileName: string;
    mimeType?: string | null;
    bytes: Uint8Array;
    createdAt?: Date;
  }) => Promise<{ uri: string }>;
  resolveContentPath?: (uri: string) => string | null;
};

export type BuildAgentRunSendPayloadParams = {
  sessionId: string;
  content: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
  assetApi?: AssetApi;
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function resolveAttachmentName(attachment: InboundAttachment): string {
  const explicitName = normalizeOptionalString(attachment.name);
  if (explicitName) {
    return explicitName;
  }
  const explicitPath = normalizeOptionalString(attachment.path);
  if (explicitPath) {
    return basename(explicitPath);
  }
  const explicitUrl = normalizeOptionalString(attachment.url);
  if (explicitUrl) {
    try {
      const parsed = new URL(explicitUrl);
      return basename(parsed.pathname) || "asset.bin";
    } catch {
      return basename(explicitUrl) || "asset.bin";
    }
  }
  return "asset.bin";
}

async function attachmentToPart(
  attachment: InboundAttachment,
  assetApi?: AssetApi,
): Promise<NcpMessagePart> {
  const assetUri = normalizeOptionalString(attachment.assetUri);
  if (assetUri) {
    return createFilePartFromAssetUri(attachment, assetUri);
  }

  const remoteUrl = normalizeOptionalString(attachment.url);
  const localPath = normalizeOptionalString(attachment.path);
  if (localPath) {
    return await createFilePartFromLocalPath(attachment, localPath, assetApi);
  }

  if (remoteUrl) {
    return createFilePartFromRemoteUrl(attachment, remoteUrl);
  }

  throw new Error(
    `Unsupported attachment payload for "${resolveAttachmentName(attachment)}".`,
  );
}

function createBaseFilePart(attachment: InboundAttachment): {
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
} {
  return {
    ...(attachment.name ? { name: attachment.name } : {}),
    ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
    ...(typeof attachment.size === "number"
      ? { sizeBytes: attachment.size }
      : {}),
  };
}

function createFilePartFromAssetUri(
  attachment: InboundAttachment,
  assetUri: string,
): NcpMessagePart {
  return {
    type: "file",
    assetUri,
    ...createBaseFilePart(attachment),
  };
}

async function createFilePartFromLocalPath(
  attachment: InboundAttachment,
  localPath: string,
  assetApi?: AssetApi,
): Promise<NcpMessagePart> {
  if (!assetApi) {
    throw new Error("NCP asset api is unavailable for local attachments.");
  }

  const fileName = resolveAttachmentName(attachment);
  const bytes = await readFile(localPath);
  const stored = await assetApi.putBytes({
    fileName,
    mimeType: attachment.mimeType ?? null,
    bytes,
  });
  return {
    type: "file",
    assetUri: stored.uri,
    name: attachment.name ?? fileName,
    ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
    ...(typeof attachment.size === "number"
      ? { sizeBytes: attachment.size }
      : {}),
  };
}

function createFilePartFromRemoteUrl(
  attachment: InboundAttachment,
  remoteUrl: string,
): NcpMessagePart {
  return {
    type: "file",
    url: remoteUrl,
    name: attachment.name ?? resolveAttachmentName(attachment),
    ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
    ...(typeof attachment.size === "number"
      ? { sizeBytes: attachment.size }
      : {}),
  };
}

export async function buildUserMessageParts(params: {
  content: string;
  attachments?: InboundAttachment[];
  assetApi?: AssetApi;
}): Promise<NcpMessagePart[]> {
  const { assetApi, attachments, content } = params;
  const parts: NcpMessagePart[] = [];
  if (content.length > 0) {
    parts.push({
      type: "text",
      text: content,
    });
  }

  for (const attachment of attachments ?? []) {
    parts.push(await attachmentToPart(attachment, assetApi));
  }

  return parts;
}

export async function buildAgentRunSendPayload(
  params: BuildAgentRunSendPayloadParams,
): Promise<AgentRunSendIngressPayload> {
  const { assetApi, attachments, content, metadata, sessionId } = params;
  return {
    sessionId,
    content: await buildUserMessageParts({
      content,
      attachments,
      assetApi,
    }),
    metadata: structuredClone(metadata ?? {}),
  };
}
