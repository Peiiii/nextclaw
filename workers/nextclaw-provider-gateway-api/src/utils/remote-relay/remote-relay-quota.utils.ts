import {
  buildRemoteQuotaRequestErrorFrame,
  buildRemoteQuotaStreamErrorFrame,
  leaseRemoteQuotaBrowserMessages,
  releaseRemoteQuotaBrowserConnection,
} from "@/services/remote-quota-guard.service";
import type { BrowserCommandFrame, ClientAttachment } from "@/types/remote-relay.types.js";
import type { Env } from "@/types/platform";
import { parseBoundedInt } from "@/utils/platform.utils";

type RemoteRelayLeaseConsumeResult =
  | {
    ok: true;
    remainingMessages: number;
  }
  | {
    ok: false;
    remainingMessages: number;
    frame: Record<string, unknown>;
  };

export function readRemoteBrowserAttachment(request: Request): ClientAttachment | null {
  const userId = request.headers.get("x-nextclaw-remote-user-id")?.trim();
  const sessionId = request.headers.get("x-nextclaw-remote-session-id")?.trim();
  const quotaTicket = request.headers.get("x-nextclaw-remote-quota-ticket")?.trim();
  const instanceId = request.headers.get("x-nextclaw-remote-device-id")?.trim();
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
    connectedAt: new Date().toISOString()
  };
}

export async function consumeRemoteBrowserFrameQuota(params: {
  env: Env;
  attachment: ClientAttachment;
  frame: BrowserCommandFrame;
  remainingMessages: number;
}): Promise<RemoteRelayLeaseConsumeResult> {
  const { attachment, env, frame, remainingMessages } = params;

  if (frame.type === "stream.cancel") {
    return {
      ok: true,
      remainingMessages
    };
  }

  if (remainingMessages > 0) {
    return {
      ok: true,
      remainingMessages: remainingMessages - 1
    };
  }

  const requestedMessages = parseBoundedInt(
    env.REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
    10,
    1,
    100
  );
  const quota = await leaseRemoteQuotaBrowserMessages(env, {
    userId: attachment.userId,
    sessionId: attachment.sessionId,
    requestedMessages
  });
  if (!quota.ok || quota.data.grantedMessages <= 0) {
    return {
      ok: false,
      remainingMessages: 0,
      frame: frame.type === "request"
        ? buildRemoteQuotaRequestErrorFrame(frame.id, quota.ok ? {
          code: "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED",
          message: "Remote access is temporarily degraded because the platform durable object daily budget is exhausted.",
          retryAfterSeconds: 60
        } : quota.error)
        : buildRemoteQuotaStreamErrorFrame(frame.streamId, quota.ok ? {
          code: "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED",
          message: "Remote access is temporarily degraded because the platform durable object daily budget is exhausted.",
          retryAfterSeconds: 60
        } : quota.error)
    };
  }

  return {
    ok: true,
    remainingMessages: quota.data.grantedMessages - 1
  };
}

export async function releaseRemoteClientQuota(env: Env, attachment: ClientAttachment): Promise<void> {
  await releaseRemoteQuotaBrowserConnection(env, {
    userId: attachment.userId,
    ticket: attachment.quotaTicket
  });
}
