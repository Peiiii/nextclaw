import { ToolInvocationStatus } from "@nextclaw/agent-chat";
import { adaptChatMessages, type ChatMessageSource } from "./chat-message.utils";

const defaultTexts = {
  roleLabels: {
    user: "You",
    assistant: "Assistant",
    tool: "Tool",
    system: "System",
    fallback: "Message",
  },
  reasoningLabel: "Reasoning",
  toolCallLabel: "Tool Call",
  toolResultLabel: "Tool Result",
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
  unknownPartLabel: "Unknown Part",
};

function adapt(uiMessages: ChatMessageSource[]) {
  return adaptChatMessages({
    uiMessages,
    formatTimestamp: (value) => `formatted:${value}`,
    texts: defaultTexts,
  });
}

it("exposes agentId on sessions_spawn call cards when the invocation args include it", () => {
  const adapted = adapt([
    {
      id: "assistant-sessions-spawn-call",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.PARTIAL_CALL,
            toolCallId: "sessions-spawn-call-args-1",
            toolName: "sessions_spawn",
            args: '{"agentId":"planner-agent","scope":"child","title":"Planner","task":"Plan the rollout","request":{"notify":"final_reply"}}',
            result: {
              kind: "nextclaw.session_request",
              requestId: "request-3",
              sessionId: "child-session-3",
              isChildSession: true,
              title: "Planner",
              task: "Plan the rollout",
              status: "running",
            },
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "sessions_spawn",
      agentId: "planner-agent",
      statusTone: "running",
    },
  });
});

it("exposes agentId on running tool call cards even before a session-request result exists", () => {
  const adapted = adapt([
    {
      id: "assistant-sessions-spawn-call-running",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.PARTIAL_CALL,
            toolCallId: "sessions-spawn-call-running-1",
            toolName: "sessions_spawn",
            args: '{"agentId":"planner-agent","scope":"child","task":"Plan the rollout"}',
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "sessions_spawn",
      agentId: "planner-agent",
      statusTone: "running",
      titleLabel: "Tool Call",
    },
  });
});
