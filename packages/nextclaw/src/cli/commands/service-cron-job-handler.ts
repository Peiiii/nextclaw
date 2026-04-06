import type { MessageBus } from "@nextclaw/core";
import type { GatewayAgentRuntimePool } from "./agent-runtime-pool.js";

type CronJobLike = {
  id: string;
  payload: {
    message: string;
    agentId?: string | null;
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

function buildCronJobMetadata(accountId?: string): Record<string, unknown> {
  if (!accountId) {
    return {};
  }
  return { accountId, account_id: accountId };
}

export function createCronJobHandler(params: {
  runtimePool: GatewayAgentRuntimePool;
  bus: MessageBus;
}): (job: CronJobLike) => Promise<string> {
  return async (job: CronJobLike): Promise<string> => {
    const accountId = normalizeOptionalString(job.payload.accountId);
    const metadata = buildCronJobMetadata(accountId);
    const agentId = normalizeOptionalString(job.payload.agentId) ?? params.runtimePool.primaryAgentId;
    const response = await params.runtimePool.processDirect({
      content: job.payload.message,
      sessionKey: `cron:${job.id}`,
      channel: job.payload.channel ?? "cli",
      chatId: job.payload.to ?? "direct",
      metadata,
      agentId
    });

    if (job.payload.deliver && job.payload.to) {
      await params.bus.publishOutbound({
        channel: job.payload.channel ?? "cli",
        chatId: job.payload.to,
        content: response,
        media: [],
        metadata
      });
    }

    return response;
  };
}
