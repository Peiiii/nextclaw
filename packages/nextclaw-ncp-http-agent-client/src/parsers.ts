import type { NcpEndpointEvent, NcpError } from "@nextclaw/ncp";
import { isRecord, normalizeErrorCode } from "./utils.js";

export function parseNcpEvent(rawData: string): NcpEndpointEvent | null {
  const parsed = parseJsonRecord(rawData);
  if (!parsed) {
    return null;
  }
  if (typeof parsed.type !== "string" || !parsed.type.trim()) {
    return null;
  }
  return parsed as NcpEndpointEvent;
}

export function parseNcpError(rawData: string): NcpError {
  const parsed = parseJsonRecord(rawData);
  if (!parsed) {
    return {
      code: "runtime-error",
      message: rawData || "Unknown stream error.",
    };
  }

  const inputCode = typeof parsed.code === "string" ? parsed.code : undefined;
  const normalizedCode = normalizeErrorCode(inputCode);
  const details = isRecord(parsed.details) ? parsed.details : {};

  if (inputCode && inputCode !== normalizedCode) {
    details.originalCode = inputCode;
  }

  return {
    code: normalizedCode,
    message: typeof parsed.message === "string" && parsed.message ? parsed.message : "Unknown stream error.",
    ...(Object.keys(details).length > 0 ? { details } : {}),
  };
}

export function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
