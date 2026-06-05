import { AigenError } from "@/types/cli-output.types.js";

export type ParsedDataUrl = {
  mimeType: string;
  bytes: Uint8Array;
};

export const parseImageDataUrl = (value: string): ParsedDataUrl => {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value);

  if (!match) {
    throw new AigenError("PROVIDER_REQUEST_FAILED", "Provider returned an invalid image data URL.");
  }

  return {
    mimeType: match[1] ?? "application/octet-stream",
    bytes: Uint8Array.from(Buffer.from(match[2] ?? "", "base64"))
  };
};

export const isDataUrl = (value: string): boolean => value.startsWith("data:");
