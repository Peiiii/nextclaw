import type { ExtensionLifecycleService } from "@kernel/features/extension-runtime/services/extension-lifecycle.service.js";
import type {
  ExtensionChannelRequestKind,
  ExtensionLease,
  ExtensionManifest,
  ExtensionProcessExitEvent,
} from "@kernel/features/extension-runtime/types/extension-runtime.types.js";
import {
  normalizeChannelConfigResult,
  readRecord,
  readRequiredString,
  readString,
} from "@kernel/features/extension-runtime/utils/extension-runtime-payload.utils.js";

const EXTENSION_AUTH_HANDOFF_TIMEOUT_MS = 60_000;

type AuthLeaseRecord = {
  extensionId: string;
  generation: string;
  lease: ExtensionLease;
  timer: ReturnType<typeof setTimeout>;
};

type ExtensionAuthLeaseServiceOptions = {
  findManifest: (extensionId: string) => ExtensionManifest;
  getEndpoint: () => string | null;
  hasPersistentLease: (extensionId: string, channelId: string) => boolean;
  lifecycle: Pick<ExtensionLifecycleService, "acquire">;
};

type ExtensionRequestParams = {
  extensionId: string;
  kind: ExtensionChannelRequestKind;
  payload: Record<string, unknown>;
};

export class ExtensionAuthLeaseService {
  private readonly handoffs = new Map<string, AuthLeaseRecord>();
  private readonly sessions = new Map<string, AuthLeaseRecord>();

  constructor(private readonly options: ExtensionAuthLeaseServiceOptions) {}

  updateAfterRequest = async (
    params: ExtensionRequestParams,
    value: unknown,
    generation: string,
  ): Promise<void> => {
    const { extensionId, kind, payload } = params;
    const channelId = readRequiredString(payload.channelId, "channelId");
    if (kind === "channel.auth.start") {
      await this.retainSession({ extensionId, generation, result: value });
      return;
    }
    if (kind === "channel.auth.poll") {
      const sessionId = readRequiredString(payload.sessionId, "sessionId");
      const result = value ? readRecord(value) : null;
      const status = result ? readString(result.status) : null;
      if (status === "authorized") {
        await this.retainHandoff(extensionId, channelId, generation);
      }
      if (!result || status === "authorized" || status === "expired" || status === "error") {
        this.releaseSession(extensionId, sessionId);
      }
      return;
    }
    if (kind === "channel.auth.connect" && readString(readRecord(value).status) === "authorized") {
      await this.retainHandoff(extensionId, channelId, generation);
      return;
    }
    if (kind === "channel.auth.login" && readRecord(normalizeChannelConfigResult(value)).enabled === true) {
      await this.retainHandoff(extensionId, channelId, generation);
    }
  };

  requireSession = (extensionId: string, sessionId: string): { generation: string } => {
    const record = this.sessions.get(this.sessionKey(extensionId, sessionId));
    if (!record) {
      throw new Error(`Extension auth session is unavailable: ${sessionId}`);
    }
    return record;
  };

  releaseHandoff = (extensionId: string, channelId: string): void => {
    this.releaseRecord(this.handoffs, this.handoffKey(extensionId, channelId));
  };

  releaseAll = (): void => {
    for (const record of [...this.sessions.values(), ...this.handoffs.values()]) {
      clearTimeout(record.timer);
      record.lease.release();
    }
    this.sessions.clear();
    this.handoffs.clear();
  };

  handleProcessExit = (event: ExtensionProcessExitEvent): void => {
    this.releaseGenerationRecords(this.sessions, event);
    this.releaseGenerationRecords(this.handoffs, event);
  };

  private readonly retainSession = async (params: {
    extensionId: string;
    generation: string;
    result: unknown;
  }): Promise<void> => {
    const { extensionId, generation } = params;
    const result = readRecord(params.result);
    const sessionId = readRequiredString(result.sessionId, "sessionId");
    const expiresAt = readRequiredString(result.expiresAt, "expiresAt");
    const expiresAtMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new Error("Extension auth session has an invalid expiresAt");
    }
    const endpoint = this.requireEndpoint("auth start");
    const lease = await this.options.lifecycle.acquire(this.options.findManifest(extensionId), {
      endpoint,
      expectedGeneration: generation,
      reason: { kind: "auth-session", sessionId, expiresAt },
    });
    const key = this.sessionKey(extensionId, sessionId);
    this.releaseRecord(this.sessions, key);
    const timer = setTimeout(() => this.releaseRecord(this.sessions, key), Math.min(
      expiresAtMs - Date.now(),
      2_147_483_647,
    ));
    timer.unref?.();
    this.sessions.set(key, { extensionId, generation, lease, timer });
  };

  private readonly retainHandoff = async (
    extensionId: string,
    channelId: string,
    generation: string,
  ): Promise<void> => {
    if (this.options.hasPersistentLease(extensionId, channelId)) {
      return;
    }
    const endpoint = this.requireEndpoint("auth handoff");
    const expiresAt = new Date(Date.now() + EXTENSION_AUTH_HANDOFF_TIMEOUT_MS).toISOString();
    const lease = await this.options.lifecycle.acquire(this.options.findManifest(extensionId), {
      endpoint,
      expectedGeneration: generation,
      reason: { kind: "auth-handoff", channelId, expiresAt },
    });
    const key = this.handoffKey(extensionId, channelId);
    this.releaseRecord(this.handoffs, key);
    const timer = setTimeout(() => {
      if (this.handoffs.has(key)) {
        console.error(`Extension ${extensionId} auth handoff expired before channel ${channelId} became enabled.`);
      }
      this.releaseRecord(this.handoffs, key);
    }, EXTENSION_AUTH_HANDOFF_TIMEOUT_MS);
    timer.unref?.();
    this.handoffs.set(key, { extensionId, generation, lease, timer });
  };

  private readonly releaseSession = (extensionId: string, sessionId: string): void => {
    this.releaseRecord(this.sessions, this.sessionKey(extensionId, sessionId));
  };

  private readonly releaseRecord = (records: Map<string, AuthLeaseRecord>, key: string): void => {
    const record = records.get(key);
    if (!record) {
      return;
    }
    records.delete(key);
    clearTimeout(record.timer);
    record.lease.release();
  };

  private readonly releaseGenerationRecords = (
    records: Map<string, AuthLeaseRecord>,
    event: ExtensionProcessExitEvent,
  ): void => {
    for (const [key, record] of records) {
      if (record.extensionId === event.extensionId && record.generation === event.generation) {
        this.releaseRecord(records, key);
      }
    }
  };

  private readonly requireEndpoint = (operation: string): string => {
    const endpoint = this.options.getEndpoint();
    if (!endpoint) {
      throw new Error(`Extension runtime stopped during ${operation}`);
    }
    return endpoint;
  };

  private readonly handoffKey = (extensionId: string, channelId: string): string =>
    `${extensionId}:${channelId}`;

  private readonly sessionKey = (extensionId: string, sessionId: string): string =>
    `${extensionId}:${sessionId}`;
}
