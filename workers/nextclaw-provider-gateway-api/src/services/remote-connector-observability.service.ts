import type {
  ConnectorAttachment,
  ConnectorCloseObservation,
} from "@/types/remote-relay.types.js";

export class RemoteConnectorObservabilityService {
  recordConnected = (params: {
    connectionId: string;
    deviceId: string;
    connectedAt: string;
    browserConnectionCount: number;
  }): void => {
    const {
      browserConnectionCount,
      connectedAt,
      connectionId,
      deviceId,
    } = params;
    console.info("Remote connector connected.", {
      event: "remote.connector.connected",
      connectionId,
      deviceId,
      connectedAt,
      browserConnectionCount,
    });
  };

  recordDisconnected = (params: {
    attachment: ConnectorAttachment;
    observation: ConnectorCloseObservation;
    disconnectedAt: Date;
    browserConnectionCount: number;
  }): void => {
    const { attachment, browserConnectionCount, disconnectedAt, observation } =
      params;
    const connectedAtMs = Date.parse(attachment.connectedAt);
    console.warn("Remote connector disconnected.", {
      event: "remote.connector.disconnected",
      connectionId: attachment.connectionId,
      deviceId: attachment.deviceId,
      disconnectedAt: disconnectedAt.toISOString(),
      connectedDurationMs: Number.isFinite(connectedAtMs)
        ? Math.max(0, disconnectedAt.getTime() - connectedAtMs)
        : null,
      closeSource: observation.source,
      closeCode: observation.code,
      closeReason: observation.reason || null,
      wasClean: observation.wasClean,
      browserConnectionCount,
    });
  };

  recordUnavailable = (params: {
    source:
      | "browser_message"
      | "browser_upgrade"
      | "proxy_request"
      | "proxy_send";
    deviceId?: string | null;
    path: string;
    connectionId?: string | null;
    reason?: string | null;
  }): string => {
    const { connectionId, deviceId, path, reason, source } = params;
    const incidentId = crypto.randomUUID();
    console.warn("Remote connector unavailable.", {
      event: "remote.connector.unavailable",
      incidentId,
      source,
      connectionId: connectionId ?? null,
      deviceId: deviceId ?? null,
      path,
      reason: reason ?? null,
    });
    return incidentId;
  };

  createUnavailableResponse = (params: {
    request: Request;
    source: "browser_upgrade" | "proxy_request" | "proxy_send";
    connectionId?: string | null;
    reason?: string | null;
  }): Response => {
    const { connectionId, reason, request, source } = params;
    const incidentId = this.recordUnavailable({
      source,
      connectionId: connectionId ?? null,
      deviceId:
        request.headers
          .get("x-nextclaw-remote-device-id")
          ?.trim() ?? null,
      path: new URL(request.url).pathname,
      reason: reason ?? null,
    });
    return new Response("Remote device connector is offline.", {
      status: 503,
      headers: {
        "retry-after": "5",
        "x-nextclaw-incident-id": incidentId,
      },
    });
  };
}
