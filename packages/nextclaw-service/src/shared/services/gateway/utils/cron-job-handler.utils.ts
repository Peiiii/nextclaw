import type { MessageBus } from "@nextclaw/core";
import {
  buildAgentRunSendPayload,
  type AgentRunClient,
} from "@nextclaw/kernel";

type CronJobLike = {
  id: string;
  name: string;
  payload: {
    message: string;
    agentId?: string | null;
    sessionId?: string | null;
    deliver?: boolean;
    channel?: string | null;
    to?: string | null;
    accountId?: string | null;
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
  accountId?: string;
}): Record<string, unknown> {
  const { job, agentId, accountId } = params;
  const channel = normalizeOptionalString(job.payload.channel) ?? "cli";
  const chatId = normalizeOptionalString(job.payload.to) ?? "direct";
  const metadata: Record<string, unknown> = {
    agentId,
    channel,
    chatId,
    label: job.name,
    cron_job_id: job.id,
    cron_job_name: job.name,
    session_origin: "cron",
  };
  if (accountId) {
    metadata.accountId = accountId;
  }
  return metadata;
}

export function createCronJobHandler(params: {
  agentRunClient: AgentRunClient;
  bus: MessageBus;
}): (job: CronJobLike) => Promise<string> {
  return async (job: CronJobLike): Promise<string> => {
    const accountId = normalizeOptionalString(job.payload.accountId);
    const agentId = normalizeOptionalString(job.payload.agentId) ?? "main";
    const sessionId = normalizeOptionalString(job.payload.sessionId) ?? `cron:${job.id}`;
    const metadata = buildCronSessionMetadata({
      job,
      agentId,
      accountId,
    });
    const result = await params.agentRunClient.sendAndWaitForReply(await buildAgentRunSendPayload({
      sessionId,
      content: job.payload.message,
      metadata,
    }), {
      missingCompletedMessageError: "cron job completed without a final assistant message",
      runErrorMessage: "cron job failed",
    });
    const response = result.text;

    if (job.payload.deliver && job.payload.to) {
      await params.bus.publishOutbound({
        channel: job.payload.channel ?? "cli",
        chatId: job.payload.to,
        content: response,
        media: [],
        metadata,
      });
    }

    return response;
  };
}
