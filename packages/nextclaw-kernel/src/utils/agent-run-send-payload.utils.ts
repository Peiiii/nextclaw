import type { InboundAttachment } from "@nextclaw/core";
import type { NcpMessagePart } from "@nextclaw/ncp";
import type { AgentRunSendIngressPayload } from "@nextclaw/shared";

export type AssetApi = {
  putPath?: (input: {
    path: string;
    fileName?: string;
    mimeType?: string | null;
  }) => Promise<{ uri: string }>;
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
    return explicitPath.split(/[\\/]/).filter(Boolean).at(-1) ?? "asset.bin";
  }
  const explicitUrl = normalizeOptionalString(attachment.url);
  if (explicitUrl) {
    try {
      const parsed = new URL(explicitUrl);
      return parsed.pathname.split("/").filter(Boolean).at(-1) ?? "asset.bin";
    } catch {
      return explicitUrl.split("/").filter(Boolean).at(-1) ?? "asset.bin";
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
  if (!assetApi?.putPath) {
    throw new Error("NCP asset api is unavailable for local attachments.");
  }

  const fileName = resolveAttachmentName(attachment);
  const stored = await assetApi.putPath({
    path: localPath,
    fileName,
    mimeType: attachment.mimeType ?? null,
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
