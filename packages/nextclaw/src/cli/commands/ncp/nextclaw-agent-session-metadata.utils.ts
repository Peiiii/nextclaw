import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import {
  cloneMetadata,
  extractMessageMetadata,
  mergeSessionMetadata,
} from "./nextclaw-ncp-message-bridge.js";

export function resolvePersistedSessionMetadata(params: {
  currentMetadata: Record<string, unknown>;
  sessionRecord: AgentSessionRecord;
  preserveExistingMetadata: boolean;
}): Record<string, unknown> {
  const messageMetadata = extractMessageMetadata(params.sessionRecord.messages);
  const nextMetadata = params.preserveExistingMetadata
    ? mergeSessionMetadata(params.currentMetadata, messageMetadata)
    : mergeSessionMetadata({}, messageMetadata);
  return mergeSessionMetadata(nextMetadata, cloneMetadata(params.sessionRecord.metadata));
}
