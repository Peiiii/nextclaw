import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import {
  cloneMetadata,
  extractMessageMetadata,
  mergeSessionMetadata,
} from "@kernel/agent-runtime/nextclaw-ncp-message-bridge.utils.js";

export function resolvePersistedSessionMetadata(params: {
  currentMetadata: Record<string, unknown>;
  sessionRecord: AgentSessionRecord;
  preserveExistingMetadata: boolean;
}): Record<string, unknown> {
  const { currentMetadata, preserveExistingMetadata, sessionRecord } = params;
  const messageMetadata = extractMessageMetadata(sessionRecord.messages);
  const nextMetadata = preserveExistingMetadata
    ? mergeSessionMetadata(currentMetadata, messageMetadata)
    : mergeSessionMetadata({}, messageMetadata);
  return mergeSessionMetadata(nextMetadata, cloneMetadata(sessionRecord.metadata));
}
