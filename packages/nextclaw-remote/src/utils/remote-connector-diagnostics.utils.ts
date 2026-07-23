import type {
  RemoteConnectionDiagnostics,
  RemoteDisconnectObservation,
} from "../types/remote.types.js";

export type RemoteConnectorRuntimeDiagnostics = {
  connection: RemoteConnectionDiagnostics;
  lastConnectedAt: string | null;
};

export type RemoteConnectorControlFrame =
  | {
      type: "connector.ready";
      connectionId: string;
      protocolVersion: number;
      heartbeatAck: boolean;
    }
  | {
      type: "connector.pong";
      connectionId: string;
      heartbeatId: string;
      sentAt: string;
      serverAt: string;
    };

export function createRemoteConnectorRuntime(
  observedAt: Date,
): RemoteConnectorRuntimeDiagnostics {
  return {
    connection: {
      observedSince: observedAt.toISOString(),
      connectionId: null,
      connectedAt: null,
      heartbeatSupported: false,
      lastHeartbeatSentAt: null,
      lastHeartbeatAckAt: null,
      lastHeartbeatLatencyMs: null,
      disconnectCount: 0,
      consecutiveFailures: 0,
      reconnectAttempt: 0,
      nextReconnectAt: null,
      lastDisconnect: null,
      lastRecoveredAt: null,
      lastRecoveryDurationMs: null,
    },
    lastConnectedAt: null,
  };
}

export function startRemoteConnectionCycle(
  runtime: RemoteConnectorRuntimeDiagnostics,
  connectionId: string,
): RemoteConnectorRuntimeDiagnostics {
  return {
    ...runtime,
    connection: {
      ...runtime.connection,
      connectionId,
      connectedAt: null,
      heartbeatSupported: false,
      lastHeartbeatSentAt: null,
      lastHeartbeatAckAt: null,
      lastHeartbeatLatencyMs: null,
      nextReconnectAt: null,
    },
  };
}

export function recordRemoteConnected(
  runtime: RemoteConnectorRuntimeDiagnostics,
  connectedAt: string,
): RemoteConnectorRuntimeDiagnostics {
  const lastDisconnectedAt = runtime.connection.lastDisconnect?.at;
  const connectedAtMs = Date.parse(connectedAt);
  const disconnectedAtMs = lastDisconnectedAt
    ? Date.parse(lastDisconnectedAt)
    : Number.NaN;
  const lastRecoveredAtMs = runtime.connection.lastRecoveredAt
    ? Date.parse(runtime.connection.lastRecoveredAt)
    : Number.NaN;
  const recovered =
    Number.isFinite(connectedAtMs) &&
    Number.isFinite(disconnectedAtMs) &&
    (!Number.isFinite(lastRecoveredAtMs) || disconnectedAtMs > lastRecoveredAtMs);
  return {
    lastConnectedAt: connectedAt,
    connection: {
      ...runtime.connection,
      connectedAt,
      heartbeatSupported: false,
      lastHeartbeatSentAt: null,
      lastHeartbeatAckAt: null,
      lastHeartbeatLatencyMs: null,
      consecutiveFailures: 0,
      reconnectAttempt: 0,
      nextReconnectAt: null,
      lastRecoveredAt: recovered
        ? connectedAt
        : runtime.connection.lastRecoveredAt,
      lastRecoveryDurationMs: recovered
        ? Math.max(0, connectedAtMs - disconnectedAtMs)
        : runtime.connection.lastRecoveryDurationMs,
    },
  };
}

export function recordRemoteHeartbeatCapability(
  runtime: RemoteConnectorRuntimeDiagnostics,
): RemoteConnectorRuntimeDiagnostics {
  return {
    ...runtime,
    connection: {
      ...runtime.connection,
      heartbeatSupported: true,
    },
  };
}

export function recordRemoteHeartbeatSent(
  runtime: RemoteConnectorRuntimeDiagnostics,
  sentAt: string,
): RemoteConnectorRuntimeDiagnostics {
  return {
    ...runtime,
    connection: {
      ...runtime.connection,
      lastHeartbeatSentAt: sentAt,
    },
  };
}

export function recordRemoteHeartbeatAcknowledged(
  runtime: RemoteConnectorRuntimeDiagnostics,
  params: {
    acknowledgedAt: string;
    latencyMs: number;
  },
): RemoteConnectorRuntimeDiagnostics {
  return {
    ...runtime,
    connection: {
      ...runtime.connection,
      lastHeartbeatAckAt: params.acknowledgedAt,
      lastHeartbeatLatencyMs: params.latencyMs,
    },
  };
}

export function recordRemoteDisconnect(
  runtime: RemoteConnectorRuntimeDiagnostics,
  observation: RemoteDisconnectObservation,
): RemoteConnectorRuntimeDiagnostics {
  return {
    ...runtime,
    connection: {
      ...runtime.connection,
      connectedAt: null,
      disconnectCount: runtime.connection.disconnectCount + 1,
      nextReconnectAt: null,
      lastDisconnect: observation,
    },
  };
}

export function recordRemoteCycleClosed(
  runtime: RemoteConnectorRuntimeDiagnostics,
): RemoteConnectorRuntimeDiagnostics {
  return {
    ...runtime,
    connection: {
      ...runtime.connection,
      connectedAt: null,
      nextReconnectAt: null,
    },
  };
}

export function recordRemoteReconnectScheduled(
  runtime: RemoteConnectorRuntimeDiagnostics,
  params: {
    consecutiveFailures: number;
    reconnectAttempt: number;
    nextReconnectAt: string;
  },
): RemoteConnectorRuntimeDiagnostics {
  return {
    ...runtime,
    connection: {
      ...runtime.connection,
      consecutiveFailures: params.consecutiveFailures,
      reconnectAttempt: params.reconnectAttempt,
      nextReconnectAt: params.nextReconnectAt,
    },
  };
}

export function parseRemoteConnectorControlFrame(
  data: unknown,
): RemoteConnectorControlFrame | null {
  try {
    const frame = JSON.parse(String(data ?? "")) as Record<string, unknown>;
    if (
      frame.type === "connector.ready" &&
      typeof frame.connectionId === "string" &&
      typeof frame.protocolVersion === "number" &&
      typeof frame.heartbeatAck === "boolean"
    ) {
      return frame as RemoteConnectorControlFrame;
    }
    if (
      frame.type === "connector.pong" &&
      typeof frame.connectionId === "string" &&
      typeof frame.heartbeatId === "string" &&
      typeof frame.sentAt === "string" &&
      typeof frame.serverAt === "string"
    ) {
      return frame as RemoteConnectorControlFrame;
    }
    return null;
  } catch {
    return null;
  }
}
