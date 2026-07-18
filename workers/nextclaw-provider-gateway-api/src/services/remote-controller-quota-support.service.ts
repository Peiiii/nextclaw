import type { RemoteAccessSessionRow } from "@/types/platform";
import type { Env } from "@/types/platform";
import {
  acquireRemoteQuotaBrowserConnection,
  consumeRemoteQuotaRequest,
  releaseRemoteQuotaBrowserConnection,
} from "@/repositories/remote-quota.repository";
import { buildRemoteQuotaHttpRejection } from "@/utils/remote-quota-response.utils";

export class RemoteControllerQuotaSupportService {
  constructor(private readonly env: Env) {}

  enforceDailyQuota = async (
    userId: string,
    operationKind: "runtime_http" | "proxy_http" | "connector_connect"
  ): Promise<Response | null> => {
    const quota = await consumeRemoteQuotaRequest(this.env, {
      userId,
      operationKind
    });
    return quota.ok ? null : buildRemoteQuotaHttpRejection(quota.error);
  };

  openBrowserRelaySocket = async (params: {
    rawRequest: Request;
    session: RemoteAccessSessionRow;
    instanceId: string;
  }): Promise<Response> => {
    const { rawRequest, session, instanceId } = params;
    const clientId = crypto.randomUUID();
    const quotaTicket = crypto.randomUUID();
    const quota = await acquireRemoteQuotaBrowserConnection(this.env, {
      userId: session.user_id,
      sessionId: session.id,
      instanceId,
      clientId,
      ticket: quotaTicket
    });
    if (!quota.ok) {
      return buildRemoteQuotaHttpRejection(quota.error);
    }

    const stub = this.env.NEXTCLAW_REMOTE_RELAY.get(this.env.NEXTCLAW_REMOTE_RELAY.idFromName(instanceId));
    const headers = new Headers(rawRequest.headers);
    headers.set("x-nextclaw-remote-role", "browser");
    headers.set("x-nextclaw-remote-device-id", instanceId);
    headers.set("x-nextclaw-remote-client-id", clientId);
    headers.set("x-nextclaw-remote-user-id", session.user_id);
    headers.set("x-nextclaw-remote-session-id", session.id);
    headers.set("x-nextclaw-remote-quota-ticket", quota.data.ticket);
    headers.set("x-nextclaw-remote-quota-granted-messages", String(quota.data.grantedMessages));

    try {
      const response = await stub.fetch(new Request(rawRequest, { headers }));
      if (response.status === 101) {
        return response;
      }
      await this.releaseBrowserConnection(session.user_id, quota.data.ticket);
      return response;
    } catch (error) {
      await this.releaseBrowserConnection(session.user_id, quota.data.ticket);
      throw error;
    }
  };

  private releaseBrowserConnection = async (userId: string, ticket: string): Promise<void> => {
    await releaseRemoteQuotaBrowserConnection(this.env, {
      userId,
      ticket,
      settledMessages: 0
    });
  };
}
