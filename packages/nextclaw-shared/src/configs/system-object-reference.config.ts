export const SYSTEM_OBJECT_REFERENCE_URI_SCHEME = "nextclaw:";
export const SYSTEM_OBJECT_REFERENCE_URI_HOST = "objects";
export const SYSTEM_OBJECT_TYPE_INBOX_DELIVERY = "inbox-delivery";
export const SYSTEM_OBJECT_TYPE_CRON_JOB = "cron-job";
export const SYSTEM_OBJECT_REFERENCE_DEFAULT_LIMIT = 20;
export const SYSTEM_OBJECT_REFERENCE_MAX_LIMIT = 50;

export type SystemObjectReferenceDisplayText = {
  default: string;
  translations?: Record<string, string>;
};

export type SystemObjectReferenceGroupIcon = "calendar-clock" | "file" | "inbox";

export type SystemObjectReferenceGroupDescriptor = {
  objectType: string;
  label: SystemObjectReferenceDisplayText;
  description: SystemObjectReferenceDisplayText;
  icon: SystemObjectReferenceGroupIcon;
  order: number;
};

export type SystemObjectReferenceItem = {
  uri: string;
  objectType: string;
  objectId: string;
  label: string;
  description: string | null;
  updatedAt: string;
};

export type SystemObjectReferenceGroupView = SystemObjectReferenceGroupDescriptor & {
  items: SystemObjectReferenceItem[];
  total: number;
};

export type SystemObjectReferenceListView = {
  groups: SystemObjectReferenceGroupView[];
  total: number;
};

export type SystemObjectResolvedReference = SystemObjectReferenceItem & {
  version: string;
  assetUri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type SystemObjectReferenceResolveRequest = {
  uri: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function createSystemObjectReferenceUri(
  objectType: string,
  objectId: string,
): string {
  const normalizedType = objectType.trim();
  const normalizedId = objectId.trim();
  if (!normalizedType || !normalizedId) {
    throw new Error("System object type and id must be non-empty.");
  }
  return `nextclaw://${SYSTEM_OBJECT_REFERENCE_URI_HOST}/${encodeURIComponent(normalizedType)}/${encodeURIComponent(normalizedId)}`;
}

export function parseSystemObjectReferenceUri(
  uri: string,
): { objectType: string; objectId: string } | null {
  try {
    const parsed = new URL(uri.trim());
    if (
      parsed.protocol !== SYSTEM_OBJECT_REFERENCE_URI_SCHEME ||
      parsed.host !== SYSTEM_OBJECT_REFERENCE_URI_HOST ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length !== 2) {
      return null;
    }
    const objectType = decodeURIComponent(segments[0] ?? "").trim();
    const objectId = decodeURIComponent(segments[1] ?? "").trim();
    return objectType && objectId ? { objectType, objectId } : null;
  } catch {
    return null;
  }
}

export function readSystemObjectResolvedReference(
  value: unknown,
): SystemObjectResolvedReference | null {
  if (!isRecord(value)) return null;
  const uri = readString(value.uri);
  const objectType = readString(value.objectType);
  const objectId = readString(value.objectId);
  const label = readString(value.label);
  const updatedAt = readString(value.updatedAt);
  const version = readString(value.version);
  const assetUri = readString(value.assetUri);
  const fileName = readString(value.fileName);
  const mimeType = readString(value.mimeType);
  const { sizeBytes } = value;
  const parsed = uri ? parseSystemObjectReferenceUri(uri) : null;
  if (
    !uri || !objectType || !objectId || !parsed ||
    parsed.objectType !== objectType || parsed.objectId !== objectId ||
    !label || !updatedAt || !version || !assetUri || !fileName || !mimeType ||
    typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes < 0
  ) {
    return null;
  }
  return {
    uri,
    objectType,
    objectId,
    label,
    description: readString(value.description),
    updatedAt,
    version,
    assetUri,
    fileName,
    mimeType,
    sizeBytes,
  };
}
