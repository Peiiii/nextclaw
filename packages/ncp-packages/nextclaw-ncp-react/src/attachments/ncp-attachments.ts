import type { NcpMessagePart, NcpRequestEnvelope } from "@nextclaw/ncp";

export const DEFAULT_NCP_IMAGE_ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif";

export const DEFAULT_NCP_IMAGE_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const DEFAULT_NCP_ATTACHMENT_MAX_BYTES = 200 * 1024 * 1024;
export const DEFAULT_NCP_IMAGE_ATTACHMENT_MAX_BYTES = DEFAULT_NCP_ATTACHMENT_MAX_BYTES;
export const DEFAULT_NCP_FALLBACK_ATTACHMENT_MIME_TYPE = "application/octet-stream";

export type NcpDraftAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  assetUri?: string;
  url?: string;
  contentBase64?: string;
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

export type UploadNcpDraftAttachmentsOptions = ReadNcpDraftAttachmentsOptions & {
  uploadBatch: (files: File[]) => Promise<NcpDraftAttachment[]>;
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

function normalizeAttachmentMimeType(file: File): string {
  const mimeType = file.type.trim().toLowerCase();
  return mimeType.length > 0 ? mimeType : DEFAULT_NCP_FALLBACK_ATTACHMENT_MIME_TYPE;
}

function validateAttachmentFile(
  file: File,
  options: ReadNcpDraftAttachmentsOptions,
): { ok: true; mimeType: string } | { ok: false; rejected: NcpRejectedAttachment } {
  const acceptedMimeTypes =
    options.acceptedMimeTypes && options.acceptedMimeTypes.length > 0
      ? new Set(options.acceptedMimeTypes.map((mimeType) => mimeType.trim().toLowerCase()))
      : null;
  const maxBytes = options.maxBytes ?? DEFAULT_NCP_ATTACHMENT_MAX_BYTES;
  const mimeType = normalizeAttachmentMimeType(file);
  if (acceptedMimeTypes && !acceptedMimeTypes.has(mimeType)) {
    return {
      ok: false,
      rejected: {
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        reason: "unsupported-type",
      },
    };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      rejected: {
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        reason: "too-large",
      },
    };
  }
  return { ok: true, mimeType };
}

export function buildNcpImageAttachmentDataUrl(attachment: NcpDraftAttachment): string {
  if (attachment.url?.trim()) {
    return attachment.url.trim();
  }
  if (!attachment.contentBase64?.trim()) {
    throw new Error(`Attachment ${attachment.name} does not have image content.`);
  }
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
            ...(attachment.assetUri?.trim()
              ? { assetUri: attachment.assetUri.trim() }
              : {}),
            ...(attachment.url?.trim() ? { url: attachment.url.trim() } : {}),
            ...(attachment.contentBase64?.trim()
              ? { contentBase64: attachment.contentBase64.trim() }
              : {}),
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
  const attachments: NcpDraftAttachment[] = [];
  const rejected: NcpRejectedAttachment[] = [];

  for (const file of files) {
    const validation = validateAttachmentFile(file, options);
    if (!validation.ok) {
      rejected.push(validation.rejected);
      continue;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      attachments.push({
        id: createAttachmentId(),
        name: file.name,
        mimeType: validation.mimeType,
        contentBase64: toBase64Content(dataUrl),
        sizeBytes: file.size,
      });
    } catch {
      rejected.push({
        fileName: file.name,
        mimeType: validation.mimeType,
        sizeBytes: file.size,
        reason: "read-failed",
      });
    }
  }

  return { attachments, rejected };
}

export async function uploadFilesAsNcpDraftAttachments(
  files: Iterable<File>,
  options: UploadNcpDraftAttachmentsOptions,
): Promise<ReadNcpDraftAttachmentsResult> {
  const validFiles: File[] = [];
  const rejected: NcpRejectedAttachment[] = [];

  for (const file of files) {
    const validation = validateAttachmentFile(file, options);
    if (!validation.ok) {
      rejected.push(validation.rejected);
      continue;
    }
    validFiles.push(file);
  }

  if (validFiles.length === 0) {
    return { attachments: [], rejected };
  }

  try {
    const attachments = await options.uploadBatch(validFiles);
    return {
      attachments,
      rejected,
    };
  } catch {
    rejected.push(
      ...validFiles.map((file) => ({
        fileName: file.name,
        mimeType: normalizeAttachmentMimeType(file),
        sizeBytes: file.size,
        reason: "read-failed" as const,
      })),
    );
    return {
      attachments: [],
      rejected,
    };
  }
}
