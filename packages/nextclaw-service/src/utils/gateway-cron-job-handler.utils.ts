import {
  buildAgentRunSendPayload,
  type AgentRunClient,
} from "@nextclaw/kernel";
import type { NcpMessage, NcpToolInvocationPart } from "@nextclaw/ncp";

type CronJobLike = {
  id: string;
  name: string;
  payload: {
    message: string;
    agentId?: string | null;
    sessionId?: string | null;
  };
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function buildCronSessionMetadata(params: {
  job: CronJobLike;
  agentId: string;
}): Record<string, unknown> {
  const { job, agentId } = params;
  return {
    agentId,
    label: job.name,
    cron_job_id: job.id,
    cron_job_name: job.name,
    session_origin: "cron",
  };
}

function readToolFailureMessage(result: unknown): string | null {
  if (typeof result === "string" && result.startsWith("Error:")) {
    return result.slice("Error:".length).trim() || result;
  }
  if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== false) {
    return null;
  }
  const error = "error" in result ? result.error : null;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "message tool failed";
}

function findMessageToolFailure(message: NcpMessage): string | null {
  for (const part of message.parts) {
    if (part.type !== "tool-invocation" || part.toolName !== "message" || part.state !== "result") {
      continue;
    }
    const failureMessage = readToolFailureMessage((part as NcpToolInvocationPart).result);
    if (failureMessage) {
      return failureMessage;
    }
  }
  return null;
}

export function createCronJobHandler(params: {
  agentRunClient: AgentRunClient;
}): (job: CronJobLike) => Promise<string> {
  return async (job: CronJobLike): Promise<string> => {
    const agentId = normalizeOptionalString(job.payload.agentId) ?? "main";
    const sessionId = normalizeOptionalString(job.payload.sessionId) ?? `cron:${job.id}`;
    const metadata = buildCronSessionMetadata({
      job,
      agentId,
    });
    const result = await params.agentRunClient.sendAndWaitForReply(await buildAgentRunSendPayload({
      sessionId,
      content: job.payload.message,
      metadata,
    }), {
      missingCompletedMessageError: "cron job completed without a final assistant message",
      runErrorMessage: "cron job failed",
    });
    const messageFailure = findMessageToolFailure(result.completedMessage);
    if (messageFailure) {
      throw new Error(`cron message delivery failed: ${messageFailure}`);
    }
    return result.text;
  };
}
