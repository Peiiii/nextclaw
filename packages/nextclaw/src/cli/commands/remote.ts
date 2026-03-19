import { getConfigPath, loadConfig, saveConfig, type Config } from "@nextclaw/core";
import { type RemoteConnectCommandOptions, type RemoteDoctorCommandOptions, type RemoteEnableCommandOptions, type RemoteStatusCommandOptions } from "@nextclaw/remote";
import { hostname } from "node:os";
import { isProcessRunning, readServiceState } from "../utils.js";
import { createNextclawRemoteConnector, resolveNextclawRemoteStatusSnapshot } from "./remote-runtime-support.js";

type RemoteConfigChange = {
  changed: boolean;
  config: Config;
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveConfiguredLocalOrigin(config: Config): string {
  const state = readServiceState();
  if (state && isProcessRunning(state.pid) && Number.isFinite(state.uiPort)) {
    return `http://127.0.0.1:${state.uiPort}`;
  }
  const port = typeof config.ui.port === "number" && Number.isFinite(config.ui.port) ? config.ui.port : 18791;
  return `http://127.0.0.1:${port}`;
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

export class RemoteCommands {
  enableConfig(opts: RemoteEnableCommandOptions = {}): RemoteConfigChange {
    const config = loadConfig(getConfigPath());
    const next: Config = {
      ...config,
      remote: {
        ...config.remote,
        enabled: true,
        ...(normalizeOptionalString(opts.apiBase) ? { platformApiBase: normalizeOptionalString(opts.apiBase) ?? "" } : {}),
        ...(normalizeOptionalString(opts.name) ? { deviceName: normalizeOptionalString(opts.name) ?? "" } : {})
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

  disableConfig(): RemoteConfigChange {
    const config = loadConfig(getConfigPath());
    const next: Config = {
      ...config,
      remote: {
        ...config.remote,
        enabled: false
      }
    };
    saveConfig(next);
    return {
      changed: config.remote.enabled !== next.remote.enabled,
      config: next
    };
  }

  async connect(opts: RemoteConnectCommandOptions = {}): Promise<void> {
    const connector = createNextclawRemoteConnector();
    await connector.run({
      ...opts,
      mode: "foreground"
    });
  }

  async status(opts: RemoteStatusCommandOptions = {}): Promise<void> {
    const config = loadConfig(getConfigPath());
    const snapshot = resolveNextclawRemoteStatusSnapshot(config);

    if (opts.json) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }

    const runtime = snapshot.runtime;
    console.log("NextClaw Remote Status");
    console.log(`Enabled: ${snapshot.configuredEnabled ? "yes" : "no"}`);
    console.log(`Mode: ${runtime?.mode ?? "service"}`);
    console.log(`State: ${runtime?.state ?? "disabled"}`);
    console.log(`Device: ${runtime?.deviceName ?? normalizeOptionalString(config.remote.deviceName) ?? hostname()}`);
    console.log(
      `Platform: ${runtime?.platformBase ?? normalizeOptionalString(config.remote.platformApiBase) ?? normalizeOptionalString(config.providers.nextclaw?.apiBase) ?? "not set"}`
    );
    console.log(`Local origin: ${runtime?.localOrigin ?? resolveConfiguredLocalOrigin(config)}`);
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

  async doctor(opts: RemoteDoctorCommandOptions = {}): Promise<void> {
    const config = loadConfig(getConfigPath());
    const snapshot = resolveNextclawRemoteStatusSnapshot(config);
    const localOrigin = resolveConfiguredLocalOrigin(config);
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
      {
        name: "platform-token",
        ok: Boolean(token),
        detail: token ? "token configured" : 'run "nextclaw login" first'
      },
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

    if (opts.json) {
      console.log(JSON.stringify({ generatedAt: new Date().toISOString(), checks, snapshot }, null, 2));
      return;
    }

    console.log("NextClaw Remote Doctor");
    for (const check of checks) {
      console.log(`${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);
    }
  }
}
