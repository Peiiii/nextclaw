const LARGE_INLINE_PAYLOAD_CHARS = 2_048;

export type SafeSerializedValue = {
  text: string;
  ok: boolean;
};

export function sanitizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

export function serializeValue(value: unknown): SafeSerializedValue {
  if (typeof value === "string") {
    return { text: value, ok: true };
  }
  try {
    return { text: JSON.stringify(value ?? null), ok: true };
  } catch (error) {
    return {
      text: `[unserializable tool result: ${error instanceof Error ? error.message : String(error)}]`,
      ok: false,
    };
  }
}

export function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= 0) {
    return "";
  }
  const marker = "\n... [truncated] ...\n";
  if (maxChars <= marker.length) {
    return value.slice(0, maxChars);
  }
  const keepChars = maxChars - marker.length;
  const headChars = Math.ceil(keepChars / 2);
  const tailChars = Math.floor(keepChars / 2);
  return `${value.slice(0, headChars)}${marker}${value.slice(value.length - tailChars)}`;
}

export function isLargeDataUrl(value: string): boolean {
  return value.length > LARGE_INLINE_PAYLOAD_CHARS && /^data:[^,]+;base64,/i.test(value);
}

export function readDataUrlMime(value: string): string {
  const match = /^data:([^;,]+)/i.exec(value);
  return match?.[1] ?? "application/octet-stream";
}

export function isLargeBase64LikeString(value: string): boolean {
  if (value.length <= LARGE_INLINE_PAYLOAD_CHARS) {
    return false;
  }
  const compact = value.replace(/\s+/g, "");
  return compact.length > LARGE_INLINE_PAYLOAD_CHARS && /^[A-Za-z0-9+/=_-]+$/.test(compact);
}

export function isBinaryLike(value: object): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

export function getBinaryByteLength(value: object): number {
  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }
  if (ArrayBuffer.isView(value)) {
    return value.byteLength;
  }
  return 0;
}

export function readStringField(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : null;
}
