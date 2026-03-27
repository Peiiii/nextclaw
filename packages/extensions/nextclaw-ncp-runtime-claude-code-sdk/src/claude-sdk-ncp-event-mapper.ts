import { type NcpEndpointEvent } from "@nextclaw/ncp";
import type { ClaudeCodeMessage } from "./claude-code-sdk-types.js";
import {
  createClaudeSdkEventMapperState,
  type ClaudeSdkEventMapperState,
} from "./claude-sdk-event-mapper-shared.js";
import {
  mapClaudeAssistantSnapshotMessage,
  mapClaudeToolProgressMessage,
  mapClaudeUserToolResultMessage,
} from "./claude-sdk-event-mapper-snapshots.js";
import {
  flushClaudeSdkMessageEventState,
  mapClaudeStreamEventMessage,
} from "./claude-sdk-event-mapper-stream.js";

export { createClaudeSdkEventMapperState, flushClaudeSdkMessageEventState };
export type { ClaudeSdkEventMapperState };

export async function* mapClaudeMessageEvent(params: {
  sessionId: string;
  messageId: string;
  message: ClaudeCodeMessage;
  state: ClaudeSdkEventMapperState;
}): AsyncGenerator<NcpEndpointEvent> {
  const { message } = params;
  const events =
    message.type === "stream_event"
      ? mapClaudeStreamEventMessage(params)
      : message.type === "assistant" || message.type === "result"
        ? mapClaudeAssistantSnapshotMessage(params)
        : message.type === "user"
          ? mapClaudeUserToolResultMessage(params)
          : message.type === "tool_progress"
            ? mapClaudeToolProgressMessage(params)
            : [];

  for (const event of events) {
    yield event;
  }
}
