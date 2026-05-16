import { type ManagedServiceState } from "@nextclaw-service/shared/stores/managed-service-state.store.js";
import { localUiRuntimeStore } from "@nextclaw-service/shared/stores/local-ui-runtime.store.js";
import { isProcessRunning } from "@nextclaw-service/shared/utils/cli.utils.js";

export type ManagedServiceSnapshot = {
  pid: number;
  uiUrl: string;
  apiUrl: string;
  uiHost: string;
  uiPort: number;
  logPath: string;
};

export function resolveManagedServiceReadySnapshot(params: {
  snapshot: ManagedServiceSnapshot;
  readLocalUiRuntimeState?: typeof localUiRuntimeStore.read;
  isProcessRunningFn?: (pid: number) => boolean;
}): ManagedServiceSnapshot {
  const { snapshot, readLocalUiRuntimeState, isProcessRunningFn: providedIsProcessRunningFn } = params;
  const localUiRuntimeState = (readLocalUiRuntimeState ?? localUiRuntimeStore.read)();
  const isProcessRunningFn = providedIsProcessRunningFn ?? isProcessRunning;
  if (
    !localUiRuntimeState
    || typeof localUiRuntimeState.pid !== "number"
    || !Number.isFinite(localUiRuntimeState.pid)
    || localUiRuntimeState.uiPort !== snapshot.uiPort
    || !isProcessRunningFn(localUiRuntimeState.pid)
  ) {
    return snapshot;
  }
  return {
    ...snapshot,
    pid: localUiRuntimeState.pid,
    uiUrl: localUiRuntimeState.uiUrl,
    apiUrl: localUiRuntimeState.apiUrl,
    uiHost: localUiRuntimeState.uiHost ?? snapshot.uiHost,
    uiPort: localUiRuntimeState.uiPort ?? snapshot.uiPort
  };
}

function toObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function hasSessionRoutingMetadata(params: {
  metadata: Record<string, unknown>;
  normalizeOptionalString: (value: unknown) => string | undefined;
}): boolean {
  const { metadata, normalizeOptionalString } = params;
  const context = toObjectRecord(metadata.last_delivery_context) ?? {};
  const hasPrimaryRoute =
    Boolean(normalizeOptionalString(context.channel)) &&
    Boolean(normalizeOptionalString(context.chatId));
  const hasFallbackRoute =
    Boolean(normalizeOptionalString(metadata.last_channel)) &&
    Boolean(normalizeOptionalString(metadata.last_to));
  return hasPrimaryRoute || hasFallbackRoute;
}

export function resolveManagedServiceUiBinding(state: ManagedServiceState): {
  host: string;
  port: number;
} {
  try {
    const parsed = new URL(state.uiUrl);
    const parsedPort = Number(parsed.port || 80);
    return {
      host: state.uiHost ?? parsed.hostname,
      port: Number.isFinite(parsedPort) ? parsedPort : state.uiPort ?? 55667
    };
  } catch {
    return {
      host: state.uiHost ?? "127.0.0.1",
      port: state.uiPort ?? 55667
    };
  }
}

export function resolveSessionRouteCandidate(params: {
  session: unknown;
  normalizeOptionalString: (value: unknown) => string | undefined;
}): { key: string; updatedAt: number } | null {
  const { session, normalizeOptionalString } = params;
  const sessionRecord = toObjectRecord(session);
  const key = normalizeOptionalString(sessionRecord?.key);
  if (!key || key.startsWith("cli:")) {
    return null;
  }
  const metadata = toObjectRecord(sessionRecord?.metadata) ?? {};
  if (!hasSessionRoutingMetadata({ metadata, normalizeOptionalString })) {
    return null;
  }
  const updatedAtRaw = normalizeOptionalString(sessionRecord?.updated_at);
  const updatedAt = updatedAtRaw ? Date.parse(updatedAtRaw) : Number.NaN;
  return {
    key,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0
  };
}
