import {
  recordRemoteQuotaWebSocketMessages,
  releaseRemoteQuotaBrowserConnection,
  settleAndLeaseRemoteQuotaBrowserMessages,
} from "@/repositories/remote-quota.repository";
import type { BrowserCommandFrame, ClientAttachment, ConnectorAttachment } from "@/types/remote-relay.types.js";
import type { Env } from "@/types/platform";
import { parseBoundedInt } from "@/utils/platform.utils";
import {
  buildRemoteQuotaRequestErrorFrame,
  buildRemoteQuotaStreamErrorFrame,
} from "@/utils/remote-quota-response.utils";

type RemoteRelayLeaseConsumeResult =
  | {
    ok: true;
    remainingMessages: number;
    unsettledMessages: number;
  }
  | {
    ok: false;
    remainingMessages: number;
    unsettledMessages: number;
    frame: Record<string, unknown> | null;
  };

export function readRemoteBrowserAttachment(request: Request): ClientAttachment | null {
  const userId = request.headers.get("x-nextclaw-remote-user-id")?.trim();
  const sessionId = request.headers.get("x-nextclaw-remote-session-id")?.trim();
  const quotaTicket = request.headers.get("x-nextclaw-remote-quota-ticket")?.trim();
  const instanceId = request.headers.get("x-nextclaw-remote-device-id")?.trim();
  const grantedMessages = Number.parseInt(
    request.headers.get("x-nextclaw-remote-quota-granted-messages") ?? "0",
    10
  );
  if (!userId || !sessionId || !quotaTicket || !instanceId) {
    return null;
  }
  return {
    type: "client",
    clientId: request.headers.get("x-nextclaw-remote-client-id")?.trim() || crypto.randomUUID(),
    userId,
    sessionId,
    instanceId,
    quotaTicket,
    connectedAt: new Date().toISOString(),
    remainingQuotaMessages: Number.isFinite(grantedMessages) ? Math.max(0, grantedMessages) : 0,
    unsettledQuotaMessages: 0,
    quotaReleased: false
  };
}

export async function consumeRemoteBrowserFrameQuota(params: {
  env: Env;
  attachment: ClientAttachment;
  frame: BrowserCommandFrame | null;
  remainingMessages: number;
  unsettledMessages: number;
}): Promise<RemoteRelayLeaseConsumeResult> {
  const { attachment, env, frame, remainingMessages } = params;
  const unsettledMessages = params.unsettledMessages + 1;

  if (remainingMessages > 0) {
    return {
      ok: true,
      remainingMessages: remainingMessages - 1,
      unsettledMessages
    };
  }

  const requestedMessages = parseBoundedInt(
    env.REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
    10,
    1,
    100
  );
  const quota = await settleAndLeaseRemoteQuotaBrowserMessages(env, {
    userId: attachment.userId,
    ticket: attachment.quotaTicket,
    settledMessages: unsettledMessages,
    requestedMessages
  });
  if (!quota.ok || quota.data.grantedMessages <= 0) {
    return {
      ok: false,
      remainingMessages: 0,
      unsettledMessages: 0,
      frame: frame?.type === "request"
        ? buildRemoteQuotaRequestErrorFrame(frame.id, quota.ok ? {
          code: "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED",
          message: "Remote access is temporarily degraded because the platform durable object daily budget is exhausted.",
          retryAfterSeconds: 60
        } : quota.error)
        : frame
          ? buildRemoteQuotaStreamErrorFrame(frame.streamId, quota.ok ? {
          code: "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED",
          message: "Remote access is temporarily degraded because the platform durable object daily budget is exhausted.",
          retryAfterSeconds: 60
        } : quota.error)
          : null
    };
  }

  return {
    ok: true,
    remainingMessages: quota.data.grantedMessages,
    unsettledMessages: 0
  };
}

export async function releaseRemoteClientQuota(env: Env, attachment: ClientAttachment): Promise<void> {
  await releaseRemoteQuotaBrowserConnection(env, {
    userId: attachment.userId,
    ticket: attachment.quotaTicket,
    settledMessages: attachment.unsettledQuotaMessages ?? 0
  });
}

export async function reportRemoteConnectorQuota(
  env: Env,
  attachment: ConnectorAttachment
): Promise<boolean> {
  const messages = attachment.unsettledQuotaMessages ?? 0;
  if (messages <= 0 || !attachment.userId) {
    return true;
  }
  const quota = await recordRemoteQuotaWebSocketMessages(env, {
    userId: attachment.userId,
    messages
  });
  return quota.ok;
}
