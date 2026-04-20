import { ToolInvocationStatus, type UiMessage } from "@nextclaw/agent-chat";
import { adaptChatMessages } from "./chat-message.utils";
import type { ChatMessageSource } from "./chat-message.utils";

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

function adapt(uiMessages: UiMessage[]) {
  return adaptChatMessages({
    uiMessages: uiMessages as unknown as ChatMessageSource[],
    formatTimestamp: (value) => `formatted:${value}`,
    texts: defaultTexts,
  });
}

it("renders child-session creation cards for sessions_spawn and keeps child-panel navigation", () => {
  const adapted = adapt([
    {
      id: "assistant-child-session-create",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "sessions-spawn-child-only-1",
            toolName: "sessions_spawn",
            args: '{"scope":"child","title":"Verifier","task":"Prepare a child workspace"}',
            result: {
              kind: "nextclaw.session",
              sessionId: "child-session-2",
              agentId: "verifier-agent",
              isChildSession: true,
              title: "Verifier",
              sessionType: "native",
              lifecycle: "persistent",
              parentSessionId: "parent-session-2",
              createdAt: "2026-04-09T09:00:00.000Z",
            },
          },
        },
      ],
    },
  ]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "sessions_spawn",
      agentId: "verifier-agent",
      summary: "title: Verifier · session: child-session-2",
      input: `{
  "scope": "child",
  "title": "Verifier",
  "task": "Prepare a child workspace"
}`,
      output: [
        "Session ID: child-session-2",
        "",
        "Target: child",
        "",
        "Title: Verifier",
        "",
        "Session Type: native",
        "",
        "Lifecycle: persistent",
        "",
        "Parent Session ID: parent-session-2",
        "",
        "Created At: 2026-04-09T09:00:00.000Z",
      ].join("\n"),
      statusTone: "success",
      action: {
        kind: "open-session",
        sessionId: "child-session-2",
        sessionKind: "child",
        agentId: "verifier-agent",
        label: "Verifier",
        parentSessionId: "parent-session-2",
      },
    },
  });
});
