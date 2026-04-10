import type { MessageBus } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpAgentRunApi,
  type NcpMessage,
  type NcpSessionApi,
} from "@nextclaw/ncp";
import type { UiNcpAgentHandle } from "../../ncp/create-ui-ncp-agent.js";

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

type CronNcpAgent = Pick<UiNcpAgentHandle, "runApi" | "sessionApi">;

function buildCronSessionMetadata(params: {
  job: CronJobLike;
  agentId: string;
  accountId?: string;
}): Record<string, unknown> {
  const { job, agentId, accountId } = params;
  const channel = normalizeOptionalString(job.payload.channel) ?? "cli";
  const chatId = normalizeOptionalString(job.payload.to) ?? "direct";
  const metadata: Record<string, unknown> = {
    ...buildCronJobMetadata(accountId),
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

function extractMessageText(message: NcpMessage | undefined): string | undefined {
  if (!message) {
    return undefined;
  }
  const parts = message.parts
    .flatMap((part) => {
      if (part.type === "text" || part.type === "rich-text") {
        return [part.text];
      }
      return [];
    })
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function findLatestAssistantMessage(messages: readonly NcpMessage[]): NcpMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return message;
    }
  }
  return undefined;
}

async function runCronJobOverNcp(params: {
  agent: Pick<CronNcpAgent, "runApi" | "sessionApi">;
  job: CronJobLike;
  sessionId: string;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const { agent, job, sessionId, metadata } = params;
  let completedMessage: NcpMessage | undefined;
  const message = buildCronUserMessage({
    sessionId,
    content: job.payload.message,
    metadata,
  });

  for await (const event of agent.runApi.send({
    sessionId,
    message,
    metadata,
  })) {
    if (event.type === NcpEventType.MessageFailed) {
      throw new Error(event.payload.error.message);
    }
    if (event.type === NcpEventType.RunError) {
      throw new Error(event.payload.error ?? "cron job failed");
    }
    if (event.type === NcpEventType.MessageCompleted) {
      completedMessage = event.payload.message;
    }
  }

  const completedText = extractMessageText(completedMessage);
  if (completedText) {
    return completedText;
  }

  const messages = await agent.sessionApi.listSessionMessages(sessionId);
  return extractMessageText(findLatestAssistantMessage(messages)) ?? "";
}

export function createCronJobHandler(params: {
  resolveNcpAgent: () => CronNcpAgent | null;
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
    const response = await runCronJobOverNcp({
      agent: ncpAgent,
      job,
      sessionId,
      metadata,
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
