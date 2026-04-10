import type { MessageBus } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpAgentRunApi,
  type NcpMessage,
} from "@nextclaw/ncp";

type CronJobLike = {
  id: string;
  name: string;
  payload: {
    message: string;
    agentId?: string | null;
    deliver?: boolean;
    channel?: string | null;
    to?: string | null;
    accountId?: string | null;
  };
};

type BackgroundNcpAgent = {
  runApi: NcpAgentRunApi;
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
    agent_id: agentId,
    channel,
    chatId,
    chat_id: chatId,
    label: job.name,
    cron_job_id: job.id,
    cron_job_name: job.name,
    session_origin: "cron",
  };
  if (accountId) {
    metadata.accountId = accountId;
    metadata.account_id = accountId;
  }
  return metadata;
}

function buildCronUserMessage(params: {
  sessionId: string;
  content: string;
  metadata: Record<string, unknown>;
}): NcpMessage {
  const { sessionId, content, metadata } = params;
  const timestamp = new Date().toISOString();
  return {
    id: `${sessionId}:user:cron:${timestamp}`,
    sessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: [{ type: "text", text: content }],
    metadata: structuredClone(metadata),
  };
}

function extractMessageText(message: NcpMessage): string {
  const parts = message.parts
    .flatMap((part) => {
      if (part.type === "text" || part.type === "rich-text") {
        return [part.text];
      }
      return [];
    })
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
  return parts.join("\n\n");
}

async function runJobOverNcp(params: {
  agent: BackgroundNcpAgent;
  sessionId: string;
  message: NcpMessage;
  metadata: Record<string, unknown>;
  missingCompletedMessageError: string;
  runErrorMessage: string;
}): Promise<string> {
  const {
    agent,
    sessionId,
    message,
    metadata,
    missingCompletedMessageError,
    runErrorMessage,
  } = params;
  let completedMessage: NcpMessage | undefined;

  for await (const event of agent.runApi.send({
    sessionId,
    message,
    metadata,
  })) {
    if (event.type === NcpEventType.MessageFailed) {
      throw new Error(event.payload.error.message);
    }
    if (event.type === NcpEventType.RunError) {
      throw new Error(event.payload.error ?? runErrorMessage);
    }
    if (event.type === NcpEventType.MessageCompleted) {
      completedMessage = event.payload.message;
    }
  }

  if (!completedMessage) {
    throw new Error(missingCompletedMessageError);
  }
  return extractMessageText(completedMessage);
}

export function createCronJobHandler(params: {
  resolveNcpAgent: () => BackgroundNcpAgent | null;
  bus: MessageBus;
}): (job: CronJobLike) => Promise<string> {
  return async (job: CronJobLike): Promise<string> => {
    const ncpAgent = params.resolveNcpAgent();
    if (!ncpAgent) {
      throw new Error("NCP agent is not ready for cron execution.");
    }
    const accountId = normalizeOptionalString(job.payload.accountId);
    const agentId = normalizeOptionalString(job.payload.agentId) ?? "main";
    const sessionId = `cron:${job.id}`;
    const metadata = buildCronSessionMetadata({
      job,
      agentId,
      accountId,
    });
    const response = await runJobOverNcp({
      agent: ncpAgent,
      sessionId,
      message: buildCronUserMessage({
        sessionId,
        content: job.payload.message,
        metadata,
      }),
      metadata,
      missingCompletedMessageError: "cron job completed without a final assistant message",
      runErrorMessage: "cron job failed",
    });

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

function buildHeartbeatMetadata(params: {
  agentId: string;
}): Record<string, unknown> {
  return {
    agentId: params.agentId,
    agent_id: params.agentId,
    channel: "cli",
    chatId: "direct",
    chat_id: "direct",
    label: "heartbeat",
    session_origin: "heartbeat",
  };
}

function buildHeartbeatUserMessage(params: {
  content: string;
  metadata: Record<string, unknown>;
}): NcpMessage {
  const timestamp = new Date().toISOString();
  return {
    id: `heartbeat:user:${timestamp}`,
    sessionId: "heartbeat",
    role: "user",
    status: "final",
    timestamp,
    parts: [{ type: "text", text: params.content }],
    metadata: structuredClone(params.metadata),
  };
}

export function createHeartbeatJobHandler(params: {
  resolveNcpAgent: () => BackgroundNcpAgent | null;
  resolveAgentId: () => string;
}): (prompt: string) => Promise<string> {
  return async (prompt: string): Promise<string> => {
    const ncpAgent = params.resolveNcpAgent();
    if (!ncpAgent) {
      throw new Error("NCP agent is not ready for heartbeat execution.");
    }

    const metadata = buildHeartbeatMetadata({
      agentId: params.resolveAgentId(),
    });

    return await runJobOverNcp({
      agent: ncpAgent,
      sessionId: "heartbeat",
      message: buildHeartbeatUserMessage({
        content: prompt,
        metadata,
      }),
      metadata,
      missingCompletedMessageError: "heartbeat execution completed without a final assistant message",
      runErrorMessage: "heartbeat execution failed",
    });
  };
}
