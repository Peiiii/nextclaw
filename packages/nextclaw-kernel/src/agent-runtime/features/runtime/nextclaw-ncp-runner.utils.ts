import type { InboundAttachment } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpAgentRunApi,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpMessagePart,
} from "@nextclaw/ncp";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { extractTextFromNcpMessage } from "@kernel/agent-runtime/nextclaw-ncp-message-bridge.utils.js";

type AssetApi = {
  put: (input: {
    fileName: string;
    mimeType?: string | null;
    bytes: Uint8Array;
    createdAt?: Date;
  }) => Promise<{ uri: string }>;
  resolveContentPath?: (uri: string) => string | null;
};

export type NcpRunnerAgent = {
  runApi: NcpAgentRunApi;
  assetApi?: AssetApi;
};

export type RunPromptOverNcpParams = {
  agent: NcpRunnerAgent;
  sessionId: string;
  content: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
  abortSignal?: AbortSignal;
  onAssistantDelta?: (delta: string) => void;
  onEvent?: (event: NcpEndpointEvent) => void;
  missingCompletedMessageError?: string;
  runErrorMessage?: string;
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
  const stored = await assetApi.put({
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

export async function buildNcpUserMessage(params: {
  sessionId: string;
  content: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
  assetApi?: AssetApi;
}): Promise<NcpMessage> {
  const { assetApi, attachments, content, metadata, sessionId } = params;
  const timestamp = new Date().toISOString();
  return {
    id: `${sessionId}:user:${timestamp}`,
    sessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: await buildUserMessageParts({
      content,
      attachments,
      assetApi,
    }),
    metadata: structuredClone(metadata ?? {}),
  };
}

export async function runPromptOverNcp(
  params: RunPromptOverNcpParams,
): Promise<{
  text: string;
  completedMessage: NcpMessage;
}> {
  const {
    abortSignal,
    agent,
    attachments,
    content,
    metadata,
    missingCompletedMessageError,
    onAssistantDelta,
    onEvent,
    runErrorMessage,
    sessionId,
  } = params;
  const message = await buildNcpUserMessage({
    sessionId,
    content,
    attachments,
    metadata,
    assetApi: agent.assetApi,
  });
  let completedMessage: NcpMessage | undefined;

  for await (const event of agent.runApi.send(
    {
      sessionId,
      message,
      metadata,
    },
    {
      ...(abortSignal ? { signal: abortSignal } : {}),
    },
  )) {
    onEvent?.(event);

    if (event.type === NcpEventType.MessageTextDelta) {
      onAssistantDelta?.(event.payload.delta);
      continue;
    }

    if (event.type === NcpEventType.MessageFailed) {
      throw new Error(event.payload.error.message);
    }

    if (event.type === NcpEventType.RunError) {
      throw new Error(event.payload.error ?? runErrorMessage ?? "NCP run failed.");
    }

    if (event.type === NcpEventType.MessageCompleted) {
      completedMessage = event.payload.message;
    }
  }

  if (!completedMessage) {
    throw new Error(
      missingCompletedMessageError ?? "NCP run completed without a final assistant message.",
    );
  }

  return {
    text: extractTextFromNcpMessage(completedMessage),
    completedMessage,
  };
}
