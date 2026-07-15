import { parseThinkingLevel } from "@nextclaw/core";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import {
  SessionSettingsError,
  type SessionSettingsPatch,
} from "@kernel/types/session.types.js";

function hasPatchField(
  patch: SessionSettingsPatch,
  field: keyof SessionSettingsPatch,
): boolean {
  return Object.prototype.hasOwnProperty.call(patch, field);
}

function readPatchString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function setOptionalMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const normalized = readPatchString(value);
  if (normalized) {
    return { ...metadata, [key]: normalized };
  }
  const nextMetadata = { ...metadata };
  delete nextMetadata[key];
  return nextMetadata;
}

function applySessionPreferencePatch(
  metadata: Record<string, unknown>,
  patch: SessionSettingsPatch,
): Record<string, unknown> {
  let nextMetadata = metadata;
  if (hasPatchField(patch, "label")) {
    nextMetadata = setOptionalMetadataValue(nextMetadata, "label", patch.label);
  }
  if (hasPatchField(patch, "preferredModel")) {
    const model = readPatchString(patch.preferredModel);
    nextMetadata = setOptionalMetadataValue(nextMetadata, "preferred_model", model);
    nextMetadata = setOptionalMetadataValue(nextMetadata, "model", model);
  }
  if (!hasPatchField(patch, "preferredThinking")) {
    return nextMetadata;
  }
  const thinking = readPatchString(patch.preferredThinking);
  if (!thinking) {
    const { preferred_thinking: _removed, ...remainingMetadata } = nextMetadata;
    return remainingMetadata;
  }
  const normalizedThinking = parseThinkingLevel(thinking);
  if (!normalizedThinking) {
    throw new SessionSettingsError(
      "PREFERRED_THINKING_INVALID",
      "preferredThinking must be a supported thinking level",
    );
  }
  return { ...nextMetadata, preferred_thinking: normalizedThinking };
}

function applySessionRuntimePatch(
  metadata: Record<string, unknown>,
  patch: SessionSettingsPatch,
): Record<string, unknown> {
  let nextMetadata = metadata;
  if (hasPatchField(patch, "sessionType")) {
    const sessionType = readPatchString(patch.sessionType);
    const { sessionType: _removed, ...metadataWithoutCamelSessionType } = nextMetadata;
    if (sessionType) {
      nextMetadata = {
        ...metadataWithoutCamelSessionType,
        session_type: sessionType,
        runtime: sessionType,
      };
    } else {
      const {
        runtime: _runtime,
        session_type: _sessionType,
        ...metadataWithoutSessionType
      } = metadataWithoutCamelSessionType;
      nextMetadata = metadataWithoutSessionType;
    }
  }
  if (hasPatchField(patch, "uiReadAt")) {
    nextMetadata = setOptionalMetadataValue(nextMetadata, "ui_last_read_at", patch.uiReadAt);
  }
  return nextMetadata;
}

export function applySessionSettingsMetadataPatch(
  currentMetadata: Record<string, unknown>,
  patch: SessionSettingsPatch,
): Record<string, unknown> {
  const metadata = applySessionPreferencePatch(structuredClone(currentMetadata), patch);
  return applySessionRuntimePatch(metadata, patch);
}

export function normalizeSessionId(sessionId: string): string {
  return sessionId.trim();
}

export function applyLimit<T>(items: T[], limit?: number): T[] {
  if (!Number.isFinite(limit) || typeof limit !== "number" || limit <= 0) {
    return items;
  }
  return items.slice(0, Math.trunc(limit));
}

export function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readOptionalMetadataString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

export function readEventSessionId(event: NcpEndpointEvent): string | undefined {
  return "payload" in event && "sessionId" in event.payload
    ? readOptionalMetadataString(event.payload.sessionId)
    : undefined;
}
