import type { NcpMessagePart, NcpRequestEnvelope } from "@nextclaw/ncp";

export const DEFAULT_NCP_IMAGE_ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif";

export const DEFAULT_NCP_IMAGE_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const DEFAULT_NCP_IMAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export type NcpDraftAttachment = {
  id: string;
  name: string;
  mimeType: string;
  contentBase64: string;
  sizeBytes: number;
};

export type NcpRejectedAttachment = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  reason: "unsupported-type" | "too-large" | "read-failed";
};

export type ReadNcpDraftAttachmentsOptions = {
  acceptedMimeTypes?: readonly string[];
  maxBytes?: number;
};

export type ReadNcpDraftAttachmentsResult = {
  attachments: NcpDraftAttachment[];
  rejected: NcpRejectedAttachment[];
};

function createAttachmentId(): string {
  return `ncp-file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Unexpected FileReader result for ${file.name}`));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function toBase64Content(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

export function buildNcpImageAttachmentDataUrl(attachment: NcpDraftAttachment): string {
  return `data:${attachment.mimeType};base64,${attachment.contentBase64}`;
}

export function buildNcpRequestEnvelope(params: {
  sessionId: string;
  text?: string;
  attachments?: readonly NcpDraftAttachment[];
  parts?: readonly NcpMessagePart[];
  metadata?: Record<string, unknown>;
  messageId?: string;
  timestamp?: string;
}): NcpRequestEnvelope | null {
  const parts =
    params.parts && params.parts.length > 0
      ? params.parts.map((part) => structuredClone(part))
      : [
          ...((params.text?.trim() ?? "")
            ? [{ type: "text" as const, text: params.text!.trim() }]
            : []),
          ...(params.attachments ?? []).map((attachment) => ({
            type: "file" as const,
            name: attachment.name,
            mimeType: attachment.mimeType,
            contentBase64: attachment.contentBase64,
            sizeBytes: attachment.sizeBytes,
          })),
        ];

  if (parts.length === 0) {
    return null;
  }

  const timestamp = params.timestamp ?? new Date().toISOString();
  const messageId = params.messageId ?? `user-${Date.now().toString(36)}`;

  return {
    sessionId: params.sessionId,
    message: {
      id: messageId,
      sessionId: params.sessionId,
      role: "user",
      status: "final",
      parts,
      timestamp,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };
}

export async function readFilesAsNcpDraftAttachments(
  files: Iterable<File>,
  options: ReadNcpDraftAttachmentsOptions = {},
): Promise<ReadNcpDraftAttachmentsResult> {
  const acceptedMimeTypes = new Set(
    options.acceptedMimeTypes ?? DEFAULT_NCP_IMAGE_ATTACHMENT_MIME_TYPES,
  );
  const maxBytes = options.maxBytes ?? DEFAULT_NCP_IMAGE_ATTACHMENT_MAX_BYTES;
  const attachments: NcpDraftAttachment[] = [];
  const rejected: NcpRejectedAttachment[] = [];

  for (const file of files) {
    const mimeType = file.type.trim().toLowerCase();
    if (!acceptedMimeTypes.has(mimeType)) {
      rejected.push({
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        reason: "unsupported-type",
      });
      continue;
    }
    if (file.size > maxBytes) {
      rejected.push({
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        reason: "too-large",
      });
      continue;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      attachments.push({
        id: createAttachmentId(),
        name: file.name,
        mimeType,
        contentBase64: toBase64Content(dataUrl),
        sizeBytes: file.size,
      });
    } catch {
      rejected.push({
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        reason: "read-failed",
      });
    }
  }

  return { attachments, rejected };
}
