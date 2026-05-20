import {
  type GatewayController,
  type CronService,
  type SessionManager
} from "@nextclaw/core";
import type { ChannelManager, ConfigManager } from "@nextclaw/kernel";
import { getPackageVersion } from "../utils/cli.utils.js";
import { NpmRuntimeUpdateCommandService } from "@nextclaw-service/launcher/npm-runtime-update-command.service.js";
import {
  parseSessionKey,
  type RestartSentinelDeliveryContext,
  writeRestartSentinel
} from "../services/restart/restart-sentinel.service.js";

type ControllerDeps = {
  configManager: ConfigManager;
  channels: ChannelManager;
  cron: CronService;
  sessionManager?: SessionManager;
  requestRestart?: (options?: { delayMs?: number; reason?: string }) => Promise<void> | void;
};

export class GatewayControllerImpl implements GatewayController {
  constructor(private deps: ControllerDeps) {}

  private normalizeOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  };

  private resolveDeliveryContext = (sessionKey?: string): RestartSentinelDeliveryContext | undefined => {
    const normalizedSessionKey = this.normalizeOptionalString(sessionKey);
    const keyTarget = parseSessionKey(normalizedSessionKey);
    const keyRoute = keyTarget && keyTarget.channel !== "agent" ? keyTarget : null;
    const session = normalizedSessionKey ? this.deps.sessionManager?.getIfExists(normalizedSessionKey) : null;
    const metadata = session?.metadata ?? {};
    const rawContext = metadata.last_delivery_context;
    const cachedContext =
      rawContext && typeof rawContext === "object" && !Array.isArray(rawContext)
        ? (rawContext as Record<string, unknown>)
        : null;
    const cachedMetadataRaw = cachedContext?.metadata;
    const cachedMetadata =
      cachedMetadataRaw && typeof cachedMetadataRaw === "object" && !Array.isArray(cachedMetadataRaw)
        ? ({ ...(cachedMetadataRaw as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const channel = this.normalizeOptionalString(cachedContext?.channel) ?? keyRoute?.channel;
    const chatId =
      this.normalizeOptionalString(cachedContext?.chatId) ??
      this.normalizeOptionalString(metadata.last_to) ??
      keyRoute?.chatId;
    const replyTo =
      this.normalizeOptionalString(cachedContext?.replyTo) ??
      this.normalizeOptionalString(metadata.last_message_id);
    const accountId =
      this.normalizeOptionalString(cachedContext?.accountId) ??
      this.normalizeOptionalString(metadata.last_account_id);

    if (!channel || !chatId) {
      return undefined;
    }

    if (accountId && !this.normalizeOptionalString(cachedMetadata.accountId)) {
      cachedMetadata.accountId = accountId;
    }

    return {
      channel,
      chatId,
      ...(replyTo ? { replyTo } : {}),
      ...(accountId ? { accountId } : {}),
      ...(Object.keys(cachedMetadata).length > 0 ? { metadata: cachedMetadata } : {})
    };
  };

  private writeRestartSentinelPayload = async (params: {
    kind: "config.apply" | "config.patch" | "update.run" | "restart";
    status: "ok" | "error" | "skipped";
    sessionKey?: string;
    note?: string;
    reason?: string;
    strategy?: string;
  }): Promise<string | null> => {
    const { kind, note, reason, sessionKey: rawSessionKey, status, strategy } = params;
    const sessionKey = this.normalizeOptionalString(rawSessionKey);
    const deliveryContext = this.resolveDeliveryContext(sessionKey);
    try {
      return await writeRestartSentinel({
        kind,
        status,
        ts: Date.now(),
        sessionKey,
        deliveryContext,
        message: note ?? null,
        stats: {
          reason: reason ?? null,
          strategy: strategy ?? null
        }
      });
    } catch {
      return null;
    }
  };

  private requestRestart = async (options?: { delayMs?: number; reason?: string }): Promise<void> => {
    const { delayMs, reason } = options ?? {};
    if (this.deps.requestRestart) {
      await this.deps.requestRestart(options);
      return;
    }
    const delay =
      typeof delayMs === "number" && Number.isFinite(delayMs) ? Math.max(0, delayMs) : 100;
    console.log(`Gateway restart requested via tool${reason ? ` (${reason})` : ""}.`);
    setTimeout(() => {
      process.exit(0);
    }, delay);
  };

  status = (): Record<string, unknown> => {
    return {
      channels: this.deps.channels.enabledChannels,
      cron: this.deps.cron.status(),
      configPath: this.deps.configManager.configPath
    };
  };

  reloadConfig = async (reason?: string): Promise<string> => {
    return this.deps.configManager.reloadConfig(reason);
  };

  restart = async (options?: { delayMs?: number; reason?: string; sessionKey?: string }): Promise<string> => {
    await this.writeRestartSentinelPayload({
      kind: "restart",
      status: "ok",
      sessionKey: options?.sessionKey,
      reason: options?.reason ?? "gateway.restart"
    });
    await this.requestRestart(options);
    return "Restart scheduled";
  };

  getConfig = async (): Promise<Record<string, unknown>> => {
    return this.deps.configManager.getConfigSnapshot({ version: getPackageVersion() });
  };

  getConfigSchema = async (): Promise<Record<string, unknown>> => {
    return this.deps.configManager.getConfigSchema({ version: getPackageVersion() });
  };

  applyConfig = async (params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> => {
    return this.deps.configManager.applyRawConfig({
      raw: params.raw,
      baseHash: params.baseHash,
      note: params.note,
      version: getPackageVersion()
    });
  };

  patchConfig = async (params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> => {
    return this.deps.configManager.patchRawConfig({
      raw: params.raw,
      baseHash: params.baseHash,
      note: params.note,
      version: getPackageVersion()
    });
  };

  updateRun = async (params: {
    note?: string;
    restartDelayMs?: number;
    timeoutMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> => {
    const { note, restartDelayMs, sessionKey, timeoutMs } = params;
    const versionBefore = getPackageVersion();
    void timeoutMs;
    const snapshot = await new NpmRuntimeUpdateCommandService().runManaged({});
    if (snapshot.status === "blocked" || snapshot.status === "failed") {
      return {
        ok: false,
        error: snapshot.errorMessage ?? snapshot.blockReason ?? "update failed",
        snapshot,
        version: {
          before: versionBefore,
          after: getPackageVersion(),
          changed: false
        }
      };
    }

    const versionAfter = getPackageVersion();
    const delayMs = restartDelayMs ?? 0;
    const sentinelPath = await this.writeRestartSentinelPayload({
      kind: "update.run",
      status: "ok",
      sessionKey,
      note,
      reason: "update.run",
      strategy: "runtime-bundle"
    });
    await this.requestRestart({ delayMs, reason: "update.run" });
    return {
      ok: true,
      note: note ?? null,
      restart: { scheduled: true, delayMs },
      strategy: "runtime-bundle",
      snapshot,
      version: {
        before: versionBefore,
        after: versionAfter,
        changed: versionBefore !== versionAfter
      },
      sentinel: sentinelPath ? { path: sentinelPath } : null
    };
  };
}
