import { ToolInvocationStatus, type UiMessage } from "@nextclaw/agent-chat";
import { adaptChatMessages } from "./chat-message.utils";
import type { ChatMessageSource } from "./chat-message.utils";
import type { ChatMessagePartViewModel } from "@nextclaw/agent-chat-ui";

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

it("truncates long structured tool summaries into a single-line ellipsis detail", () => {
  const adapted = adapt([
    {
      id: "assistant-long-tool-summary",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.PARTIAL_CALL,
            toolCallId: "call-long-tool-summary",
            toolName: "terminal",
            args: JSON.stringify({
              command:
                "ls -la /Users/peiwang/.nextclaw/workspace/skills/bird/snapshots/archive/releases/2026-04-17/builds/current/output 2>/dev/null | sed -n '1,160p' && echo 'done'",
            }),
          },
        },
      ],
    },
  ]);

  const summary = (
    adapted[0]?.parts[0] as Extract<ChatMessagePartViewModel, { type: "tool-card" }> | undefined
  )?.card.summary;

  expect(summary?.startsWith("command: ls -la /Users/peiwang/.nextclaw/workspace/skills/bird/")).toBe(true);
  expect(summary?.endsWith("…")).toBe(true);
});
