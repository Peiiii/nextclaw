import { getConfigPath, loadConfig, saveConfig, type Config } from "@nextclaw/core";
import {
  readPlatformSessionTokenState,
  type RemoteConnectCommandOptions,
  type RemoteDoctorCommandOptions,
  type RemoteEnableCommandOptions,
  type RemoteStatusCommandOptions,
  type RemoteStatusSnapshot
} from "@nextclaw/remote";
import { hostname } from "node:os";
import { localUiDiscoveryService } from "../../shared/services/local-ui-discovery.service.js";
import { createNextclawRemoteConnector, resolveNextclawRemoteStatusSnapshot } from "../remote-support/remote-runtime-support.js";

type RemoteConfigChange = {
  changed: boolean;
  config: Config;
};

export type RemoteCommandStatusView = {
  configuredEnabled: boolean;
  runtime: RemoteStatusSnapshot["runtime"];
  localOrigin: string;
  deviceName: string;
  platformBase: string | null;
};

export type RemoteCommandDoctorCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export type RemoteCommandDoctorView = {
  generatedAt: string;
  checks: RemoteCommandDoctorCheck[];
  snapshot: RemoteStatusSnapshot;
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveConfiguredLocalOrigin(config: Config): string {
  return localUiDiscoveryService.resolveLocalOrigin(config);
}

async function probeLocalUi(localOrigin: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(`${localOrigin}/api/health`);
    if (!response.ok) {
      return { ok: false, detail: `health returned ${response.status}` };
    }
    return { ok: true, detail: "health endpoint returned ok" };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function describePlatformTokenCheck(token: string | undefined): RemoteCommandDoctorCheck {
  const tokenState = readPlatformSessionTokenState(token);
  if (tokenState.valid) {
    return {
      name: "platform-token",
      ok: true,
      detail: "platform session token configured"
    };
  }
  if (tokenState.reason === "expired") {
    return {
      name: "platform-token",
      ok: false,
      detail: 'platform session token expired; run remote browser login or "nextclaw login" again'
    };
  }
  if (tokenState.reason === "malformed") {
    return {
      name: "platform-token",
      ok: false,
      detail: 'platform session token invalid; run remote browser login or "nextclaw login" again'
    };
  }
  return {
    name: "platform-token",
    ok: false,
    detail: 'run remote browser login or "nextclaw login" first'
  };
}

export class RemoteCommands {
  constructor(private readonly deps: { currentLocalOrigin?: string } = {}) {}

  updateConfig(params: {
    enabled?: boolean;
    apiBase?: string;
    name?: string;
  } = {}): RemoteConfigChange {
    const config = loadConfig(getConfigPath());
    const nextEnabled = typeof params.enabled === "boolean" ? params.enabled : config.remote.enabled;
    const nextPlatformApiBase =
      typeof params.apiBase === "string" ? params.apiBase.trim() : config.remote.platformApiBase;
    const nextDeviceName =
      typeof params.name === "string" ? params.name.trim() : config.remote.deviceName;
    const next: Config = {
      ...config,
      remote: {
        ...config.remote,
        enabled: nextEnabled,
        platformApiBase: nextPlatformApiBase,
        deviceName: nextDeviceName
      }
    };
    saveConfig(next);
    return {
      changed:
        config.remote.enabled !== next.remote.enabled ||
        config.remote.platformApiBase !== next.remote.platformApiBase ||
        config.remote.deviceName !== next.remote.deviceName,
      config: next
    };
  }

  enableConfig(opts: RemoteEnableCommandOptions = {}): RemoteConfigChange {
    return this.updateConfig({
      enabled: true,
      apiBase: typeof opts.apiBase === "string" ? opts.apiBase : undefined,
      name: typeof opts.name === "string" ? opts.name : undefined
    });
  }

  disableConfig(): RemoteConfigChange {
    return this.updateConfig({ enabled: false });
  }

  async connect(opts: RemoteConnectCommandOptions = {}): Promise<void> {
    const connector = createNextclawRemoteConnector();
    await connector.run({
      ...opts,
      mode: "foreground"
    });
  }

  getStatusView(): RemoteCommandStatusView {
    const config = loadConfig(getConfigPath());
    const snapshot = resolveNextclawRemoteStatusSnapshot(config);
    const resolvedLocalOrigin =
      snapshot.runtime?.localOrigin ??
      this.deps.currentLocalOrigin ??
      resolveConfiguredLocalOrigin(config);
    return {
      configuredEnabled: snapshot.configuredEnabled,
      runtime: snapshot.runtime,
      localOrigin: resolvedLocalOrigin,
      deviceName: snapshot.runtime?.deviceName ?? normalizeOptionalString(config.remote.deviceName) ?? hostname(),
      platformBase:
        snapshot.runtime?.platformBase ??
        normalizeOptionalString(config.remote.platformApiBase) ??
        normalizeOptionalString(config.providers.nextclaw?.apiBase) ??
        null
    };
  }

  async status(opts: RemoteStatusCommandOptions = {}): Promise<void> {
    const view = this.getStatusView();

    if (opts.json) {
      console.log(JSON.stringify(view, null, 2));
      return;
    }

    const runtime = view.runtime;
    console.log("NextClaw Remote Status");
    console.log(`Enabled: ${view.configuredEnabled ? "yes" : "no"}`);
    console.log(`Mode: ${runtime?.mode ?? "service"}`);
    console.log(`State: ${runtime?.state ?? "disabled"}`);
    console.log(`Device: ${view.deviceName}`);
    console.log(`Platform: ${view.platformBase ?? "not set"}`);
    console.log(`Local origin: ${runtime?.localOrigin ?? view.localOrigin}`);
    if (runtime?.deviceId) {
      console.log(`Device ID: ${runtime.deviceId}`);
    }
    if (runtime?.lastConnectedAt) {
      console.log(`Last connected: ${runtime.lastConnectedAt}`);
    }
    if (runtime?.lastError) {
      console.log(`Last error: ${runtime.lastError}`);
    }
  }

  async getDoctorView(): Promise<RemoteCommandDoctorView> {
    const config = loadConfig(getConfigPath());
    const snapshot = resolveNextclawRemoteStatusSnapshot(config);
    const localOrigin =
      snapshot.runtime?.localOrigin ??
      this.deps.currentLocalOrigin ??
      resolveConfiguredLocalOrigin(config);
    const localUi = await probeLocalUi(localOrigin);
    const token = normalizeOptionalString(config.providers.nextclaw?.apiKey);
    const platformApiBase =
      normalizeOptionalString(config.remote.platformApiBase) ??
      normalizeOptionalString(config.providers.nextclaw?.apiBase);
    const checks = [
      {
        name: "remote-enabled",
        ok: snapshot.configuredEnabled,
        detail: snapshot.configuredEnabled ? "enabled in config" : "disabled in config"
      },
      describePlatformTokenCheck(token),
      {
        name: "platform-api-base",
        ok: Boolean(platformApiBase),
        detail: platformApiBase ?? "set remote.platformApiBase or login with --api-base"
      },
      {
        name: "local-ui",
        ok: localUi.ok,
        detail: `${localOrigin} (${localUi.detail})`
      },
      {
        name: "service-runtime",
        ok: snapshot.runtime?.state === "connected",
        detail: snapshot.runtime ? snapshot.runtime.state : "no managed remote runtime detected"
      }
    ];
    return {
      generatedAt: new Date().toISOString(),
      checks,
      snapshot
    };
  }

  async doctor(opts: RemoteDoctorCommandOptions = {}): Promise<void> {
    const report = await this.getDoctorView();

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log("NextClaw Remote Doctor");
    for (const check of report.checks) {
      console.log(`${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);
    }
  }
}
