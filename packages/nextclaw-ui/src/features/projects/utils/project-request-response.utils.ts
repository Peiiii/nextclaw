import { nextclawClient } from "@/shared/lib/api";

export type ProjectRequestDecision = "confirmed" | "rejected";

export type SendProjectRequestResponseInput = {
  requestId: string;
  sessionId: string;
  decision: ProjectRequestDecision;
  prompt: string;
};

export async function sendProjectRequestResponse(
  input: SendProjectRequestResponseInput,
) {
  const messageId = `project-response-${input.requestId}-${input.decision}`;
  return await nextclawClient.agentRuns.send({
    sessionId: input.sessionId,
    idempotencyKey: messageId,
    delivery: "prefer-steer",
    message: {
      id: messageId,
      sessionId: input.sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{
        type: "text",
        text: `${input.decision === "confirmed" ? "确认" : "拒绝"}：${input.prompt}`,
      }],
      metadata: {
        project_observation_response: {
          protocol: "nextclaw.project/v1",
          requestId: input.requestId,
          decision: input.decision,
        },
      },
    },
  });
}
