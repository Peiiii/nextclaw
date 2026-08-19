import type { ChatMessageViewModel } from "@nextclaw/agent-chat-ui";
import type { NcpMessage } from "@nextclaw/ncp";
import { adaptNcpMessagePartsForChat, adaptNcpMessageToUiMessage } from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import { adaptChatMessage } from "./chat-message.utils";

export type ChatToolCallStressConfig = {
  toolCallCount: number;
  argumentBytesPerCall: number;
  resultBytesPerCall: number;
};

export const DEFAULT_CHAT_TOOL_CALL_STRESS_CONFIG: ChatToolCallStressConfig = {
  toolCallCount: 200,
  argumentBytesPerCall: 8_192,
  resultBytesPerCall: 8_192,
};

const STRESS_TOOL_NAMES = ["exec_command", "read_file", "web_fetch"];
const FILLER = "0123456789abcdefghijklmnopqrstuvwxyz";

const STRESS_ADAPTER_TEXTS = {
  roleLabels: {
    user: "User",
    assistant: "Assistant",
    tool: "Tool",
    system: "System",
    fallback: "Message",
  },
  reasoningLabel: "Reasoning",
  toolCallLabel: "Tool call",
  toolResultLabel: "Tool result",
  toolInputLabel: "Input",
  toolNoOutputLabel: "No output",
  toolOutputLabel: "Output",
  toolStatusPreparingLabel: "Preparing",
  toolStatusRunningLabel: "Running",
  toolStatusCompletedLabel: "Completed",
  toolStatusFailedLabel: "Failed",
  toolStatusCancelledLabel: "Cancelled",
  imageAttachmentLabel: "Image attachment",
  fileAttachmentLabel: "File attachment",
  unknownPartLabel: "Unknown part",
};

function createPayload(bytes: number, callIndex: number, kind: "argument" | "result") {
  return {
    request: {
      id: `${kind}-${callIndex}`,
      metadata: {
        callIndex,
        kind,
        labels: ["chat", "stress", "nested-payload"],
      },
      nested: {
        levelOne: {
          levelTwo: {
            levelThree: {
              payload: FILLER.repeat(Math.ceil(bytes / FILLER.length)).slice(0, bytes),
            },
          },
        },
      },
    },
  };
}

export function createChatToolCallStressMessage(
  config: ChatToolCallStressConfig = DEFAULT_CHAT_TOOL_CALL_STRESS_CONFIG,
  messageId = "chat-tool-call-stress-message",
): NcpMessage {
  const parts: NcpMessage["parts"] = [
    {
      type: "reasoning",
      text: "Simulating a dense tool-call execution trace.",
    },
  ];
  for (let index = 0; index < config.toolCallCount; index += 1) {
    parts.push({
      type: "tool-invocation",
      toolCallId: `stress-call-${index}`,
      toolName: STRESS_TOOL_NAMES[index % STRESS_TOOL_NAMES.length]!,
      state: "result",
      args: createPayload(config.argumentBytesPerCall, index, "argument"),
      result: createPayload(config.resultBytesPerCall, index, "result"),
      execution: {
        durationMs: 15 + (index % 200),
      },
    });
  }
  parts.push({
    type: "text",
    text: "Stress fixture completed.",
  });
  return {
    id: messageId,
    sessionId: "chat-tool-call-stress-session",
    role: "assistant",
    status: "final",
    timestamp: "2026-08-19T00:00:00.000Z",
    parts,
  };
}

export function createChatToolCallStressViewModel(
  config: ChatToolCallStressConfig = DEFAULT_CHAT_TOOL_CALL_STRESS_CONFIG,
  messageId?: string,
): ChatMessageViewModel {
  const message = createChatToolCallStressMessage(config, messageId);
  const uiMessage = adaptNcpMessageToUiMessage(message);
  return adaptChatMessage(
    {
      id: uiMessage.id,
      role: uiMessage.role,
      meta: uiMessage.meta,
      parts: adaptNcpMessagePartsForChat(message.parts),
    },
    {
      texts: STRESS_ADAPTER_TEXTS,
      formatTimestamp: (value) => value,
    },
  );
}
