import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  type NcpMessage,
} from "@nextclaw/ncp";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSubagentCompletionFollowUpMessage(params: {
  sessionId: string;
  label: string;
  task: string;
  result: string;
  status: "ok" | "error";
}): NcpMessage {
  const timestamp = new Date().toISOString();
  const statusLabel = params.status === "ok" ? "completed" : "failed";
  return {
    id: `${params.sessionId}:system:subagent-follow-up:${timestamp}`,
    sessionId: params.sessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: [
      {
        type: "text",
        text: [
          "<task-notification>",
          "<source>subagent_completion</source>",
          `<label>${escapeXml(params.label)}</label>`,
          `<status>${statusLabel}</status>`,
          `<delegated-task>${escapeXml(params.task)}</delegated-task>`,
          `<result>${escapeXml(params.result)}</result>`,
          "<instructions>This is an internal worker completion notification, not a new end-user message. Continue the parent task using this result. If the user's request is complete, answer directly. If more work is needed, continue reasoning and use tools. Do not mention this hidden notification unless the user explicitly asks about internal behavior.</instructions>",
          "</task-notification>",
        ].join("\n"),
      },
    ],
    metadata: {
      [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
      system_event_kind: "subagent_completion_follow_up",
      subagent_label: params.label,
      subagent_status: params.status,
      subagent_task: params.task,
    },
  };
}
