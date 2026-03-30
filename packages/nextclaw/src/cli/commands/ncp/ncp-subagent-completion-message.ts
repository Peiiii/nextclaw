import type { NcpMessage } from "@nextclaw/ncp";

export function buildSubagentCompletionMessage(params: {
  sessionId: string;
  label: string;
  task: string;
  result: string;
  status: "ok" | "error";
}): NcpMessage {
  const timestamp = new Date().toISOString();
  const statusLabel = params.status === "ok" ? "completed" : "failed";
  return {
    id: `${params.sessionId}:service:subagent:${timestamp}`,
    sessionId: params.sessionId,
    role: "service",
    status: "final",
    timestamp,
    parts: [
      {
        type: "text",
        text:
          [
            `Subagent "${params.label}" ${statusLabel}.`,
            `Task: ${params.task}`,
            `Result: ${params.result}`,
          ].join("\n\n"),
      },
      {
        type: "extension",
        extensionType: "nextclaw.subagent.completion",
        data: {
          label: params.label,
          task: params.task,
          result: params.result,
          status: params.status,
          completedAt: timestamp,
        },
      },
    ],
    metadata: {
      subagent_label: params.label,
      subagent_status: params.status,
      subagent_task: params.task,
    },
  };
}
