import type { CreateSessionContextInheritanceInput } from "@nextclaw/core";
import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { readOptionalString } from "./session-manager.utils.js";

const CONTEXT_INHERITANCE_METADATA_KEY = "context_inheritance";
const INHERITED_FROM_SESSION_METADATA_KEY = "inherited_from_session_id";
const INHERITED_FROM_MESSAGE_METADATA_KEY = "inherited_from_message_id";

function hasToolCall(message: NcpMessage, toolCallId: string): boolean {
  return message.parts.some((part) =>
    part.type === "tool-invocation" && part.toolCallId === toolCallId
  );
}

function findContextInheritanceAnchor(params: {
  anchorToolCallId?: string;
  messages: readonly NcpMessage[];
}): { index: number; message: NcpMessage } | null {
  const anchorToolCallId = readOptionalString(params.anchorToolCallId);
  if (!anchorToolCallId) {
    return null;
  }
  const index = params.messages.findIndex((message) => hasToolCall(message, anchorToolCallId));
  const message = index >= 0 ? params.messages[index] : undefined;
  return message ? { index, message } : null;
}

function createInheritedContextMessage(params: {
  childSessionId: string;
  index: number;
  sourceMessage: NcpMessage;
  sourceSessionId: string;
}): NcpMessage {
  const {
    childSessionId,
    index,
    sourceMessage,
    sourceSessionId,
  } = params;
  const message = structuredClone(sourceMessage);
  const metadata = structuredClone(message.metadata ?? {});
  metadata[INHERITED_FROM_SESSION_METADATA_KEY] = sourceSessionId;
  metadata[INHERITED_FROM_MESSAGE_METADATA_KEY] = sourceMessage.id;
  return {
    ...message,
    id: `${childSessionId}:inherited:${index + 1}`,
    sessionId: childSessionId,
    metadata,
  };
}

function createInheritedContextSnapshot(params: {
  anchorToolCallId?: string;
  childSessionId: string;
  sourceRecord: AgentSessionRecord;
}): {
  messages: NcpMessage[];
  metadata: Record<string, unknown>;
} {
  const {
    anchorToolCallId,
    childSessionId,
    sourceRecord,
  } = params;
  const anchor = findContextInheritanceAnchor({
    anchorToolCallId,
    messages: sourceRecord.messages,
  });
  const sourceMessages = (anchor
    ? sourceRecord.messages.slice(0, anchor.index)
    : sourceRecord.messages)
    .filter((message) => message.status === "final");
  const messages = sourceMessages.map((sourceMessage, index) =>
    createInheritedContextMessage({
      childSessionId,
      index,
      sourceMessage,
      sourceSessionId: sourceRecord.sessionId,
    })
  );
  return {
    messages,
    metadata: {
      enabled: true,
      sourceSessionId: sourceRecord.sessionId,
      anchorKind: anchor ? "tool_call" : "latest_persisted",
      anchorToolCallId: readOptionalString(anchorToolCallId),
      anchorMessageId: anchor?.message.id,
      inheritedMessageCount: messages.length,
    },
  };
}

export function createSessionContextInheritance(params: {
  childSessionId: string;
  contextInheritance?: CreateSessionContextInheritanceInput;
  metadata: Record<string, unknown>;
  parentSessionId: string | null;
  sourceRecord?: AgentSessionRecord | null;
}): {
  messages: NcpMessage[];
  metadata: Record<string, unknown>;
} {
  const {
    childSessionId,
    contextInheritance,
    metadata,
    parentSessionId,
    sourceRecord,
  } = params;
  if (!contextInheritance) {
    return { messages: [], metadata };
  }
  if (!parentSessionId) {
    throw new Error("contextInheritance requires a child session parentSessionId.");
  }
  if (!sourceRecord) {
    throw new Error("Cannot inherit context because the source session was not found.");
  }
  const snapshot = createInheritedContextSnapshot({
    anchorToolCallId: contextInheritance.anchorToolCallId,
    childSessionId,
    sourceRecord,
  });
  return {
    messages: snapshot.messages,
    metadata: {
      ...metadata,
      [CONTEXT_INHERITANCE_METADATA_KEY]: snapshot.metadata,
    },
  };
}
