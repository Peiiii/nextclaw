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

it("renders invalid tool arguments as a failed argument card instead of a normal raw-args card", () => {
  const rawArgumentsText = '{"task":"spawn","request">\n<｜｜DSML｜｜parameter: "final_reply"}';
  const adapted = adapt([
    {
      id: "assistant-invalid-tool-args",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "call-invalid-args",
            toolName: "sessions_spawn",
            args: rawArgumentsText,
            result: {
              ok: false,
              error: {
                code: "invalid_tool_arguments",
                message: "Tool arguments are invalid.",
                toolCallId: "call-invalid-args",
                toolName: "sessions_spawn",
                rawArgumentsText,
                issues: ["Invalid JSON"],
              },
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
      summary: "Invalid arguments: Invalid JSON",
      input: rawArgumentsText,
      output: "Invalid JSON",
      statusTone: "error",
      statusLabel: "Failed",
    },
  });
});
