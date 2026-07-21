import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { hostname, networkInterfaces, platform as readPlatform } from "node:os";
import type {
  RegisteredRemoteDevice,
  RemoteConnectCommandOptions,
  RemoteConnectorRunOptions,
  RemotePlatformClientDeps,
  RemoteRunContext,
} from "../types.js";
import { readPlatformSessionTokenState } from "../platform-session-token.js";

const REMOTE_INSTANCE_IDENTITY_VERSION = "v2";

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function maskToken(value: string): string {
  if (value.length <= 12) {
    return "<redacted>";
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readMachineIdFile(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return readFileSync(path, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

function readOperatingSystemDeviceIdentity(): string | null {
  const explicit = process.env.NEXTCLAW_REMOTE_DEVICE_ID?.trim();
  if (explicit) {
    return `explicit:${explicit}`;
  }

  if (readPlatform() === "darwin") {
    try {
      const output = execFileSync(
        "/usr/sbin/ioreg",
        ["-rd1", "-c", "IOPlatformExpertDevice"],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const platformUuid = output
        .match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1]
        ?.trim();
      if (platformUuid) {
        return `darwin:${platformUuid}`;
      }
    } catch {
      // Fall through to network identity and the persisted legacy UUID.
    }
  }

  if (readPlatform() === "linux") {
    const machineId =
      readMachineIdFile("/etc/machine-id") ??
      readMachineIdFile("/var/lib/dbus/machine-id");
    if (machineId) {
      return `linux:${machineId}`;
    }
  }

  if (readPlatform() === "win32") {
    try {
      const output = execFileSync(
        "reg.exe",
        [
          "query",
          "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
          "/v",
          "MachineGuid",
        ],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const machineGuid = output
        .match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i)?.[1]
        ?.trim();
      if (machineGuid) {
        return `windows:${machineGuid}`;
      }
    } catch {
      // Fall through to network identity and the persisted legacy UUID.
    }
  }

  const macAddresses = Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter(
      (address) => !address.internal && address.mac !== "00:00:00:00:00:00",
    )
    .map((address) => address.mac.toLowerCase())
    .sort();
  return macAddresses.length > 0 ? `network:${macAddresses.join(",")}` : null;
}

export function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolveDelay, rejectDelay) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolveDelay();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      rejectDelay(new Error("Remote connector aborted."));
    };
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export function redactWsUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    if (token) {
      parsed.searchParams.set("token", maskToken(token));
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export class RemotePlatformClient {
  constructor(
    private readonly deps: RemotePlatformClientDeps & {
      resolveDeviceIdentity?: () => string | null;
    },
  ) {}

  private get remoteDir(): string {
    return join(this.deps.getDataDir(), "remote");
  }

  private get devicePath(): string {
    return join(this.remoteDir, "device.json");
  }

  resolveRunContext = (opts: RemoteConnectorRunOptions): RemoteRunContext => {
    const { platformBase, token, config } = this.resolvePlatformAccess(opts);
    const localOrigin = this.resolveLocalOrigin(config, opts);
    return {
      config,
      platformBase,
      token,
      localOrigin,
      displayName: this.resolveDisplayName(config, opts),
      deviceInstallId: this.resolveInstanceInstallId(localOrigin),
      autoReconnect: opts.once
        ? false
        : (opts.autoReconnect ?? config.remote.autoReconnect),
    };
  };

  registerDevice = async (params: {
    platformBase: string;
    token: string;
    deviceInstallId: string;
    displayName: string;
    localOrigin: string;
  }): Promise<RegisteredRemoteDevice> => {
    const { platformBase, token, deviceInstallId, displayName, localOrigin } =
      params;
    const response = await fetch(
      `${platformBase}/platform/remote/instances/register`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          instanceInstallId: deviceInstallId,
          legacyInstanceInstallId: this.ensureLegacyDeviceInstallId(),
          identityVersion: 2,
          displayName,
          platform: readPlatform(),
          appVersion: this.deps.getPackageVersion(),
          localOrigin,
        }),
      },
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      data?: {
        instance?: {
          id: string;
          instanceInstallId: string;
          displayName: string;
          platform: string;
          appVersion: string;
          localOrigin: string;
          status: "online" | "offline";
          lastSeenAt: string;
          createdAt: string;
          updatedAt: string;
        };
        device?: RegisteredRemoteDevice;
      };
      error?: { message?: string };
    };
    const instance = payload.data?.instance;
    if (response.ok && payload.ok && instance) {
      return {
        id: instance.id,
        deviceInstallId: instance.instanceInstallId,
        displayName: instance.displayName,
        platform: instance.platform,
        appVersion: instance.appVersion,
        localOrigin: instance.localOrigin,
        status: instance.status,
        lastSeenAt: instance.lastSeenAt,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      };
    }
    if (!response.ok || !payload.ok || !payload.data?.device) {
      throw new Error(
        payload.error?.message ??
          `Failed to register remote instance (${response.status}).`,
      );
    }
    return payload.data.device;
  };

  private ensureLegacyDeviceInstallId = (): string => {
    const existing = readJsonFile<{ deviceInstallId?: string }>(
      this.devicePath,
    );
    if (existing?.deviceInstallId?.trim()) {
      return existing.deviceInstallId.trim();
    }
    const deviceInstallId = crypto.randomUUID();
    ensureDir(this.remoteDir);
    writeJsonFile(this.devicePath, { deviceInstallId });
    return deviceInstallId;
  };

  private resolveInstanceInstallId = (localOrigin: string): string => {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(localOrigin);
    } catch {
      throw new Error(`Remote local origin is invalid: ${localOrigin}`);
    }
    const port =
      parsedOrigin.port || (parsedOrigin.protocol === "https:" ? "443" : "80");
    const rawDeviceIdentity =
      this.deps.resolveDeviceIdentity?.() ??
      readOperatingSystemDeviceIdentity();
    const stableDeviceIdentity = sha256(
      rawDeviceIdentity ?? `legacy:${this.ensureLegacyDeviceInstallId()}`,
    );
    return `${REMOTE_INSTANCE_IDENTITY_VERSION}-${sha256(`nextclaw-remote-instance\0${stableDeviceIdentity}\0${port}`)}`;
  };

  private resolvePlatformAccess = (
    opts: RemoteConnectCommandOptions,
  ): {
    platformBase: string;
    token: string;
    config: ReturnType<RemotePlatformClientDeps["loadConfig"]>;
  } => {
    const config = this.deps.loadConfig();
    const providers = config.providers as Record<
      string,
      { apiBase?: string | null; apiKey?: string }
    >;
    const nextclawProvider = providers.nextclaw;
    const token =
      typeof nextclawProvider?.apiKey === "string"
        ? nextclawProvider.apiKey.trim()
        : "";
    const tokenState = readPlatformSessionTokenState(token);
    if (tokenState.reason === "missing") {
      throw new Error(
        'NextClaw platform token is missing. Run "nextclaw login" first.',
      );
    }
    if (tokenState.reason === "expired") {
      throw new Error(
        'NextClaw platform token expired. Run "nextclaw login" or browser sign-in again.',
      );
    }
    if (tokenState.reason === "malformed") {
      throw new Error(
        'NextClaw platform token is invalid. Run "nextclaw login" again.',
      );
    }
    const configuredApiBase =
      normalizeOptionalString(config.remote.platformApiBase) ??
      (typeof nextclawProvider?.apiBase === "string"
        ? nextclawProvider.apiBase.trim()
        : "");
    const rawApiBase =
      normalizeOptionalString(opts.apiBase) ?? configuredApiBase;
    if (!rawApiBase) {
      throw new Error(
        "Platform API base is missing. Pass --api-base, run nextclaw login, or set remote.platformApiBase.",
      );
    }
    const platformBase = this.deps.resolvePlatformBase(rawApiBase);
    return { platformBase, token: token.trim(), config };
  };

  private resolveLocalOrigin = (
    config: ReturnType<RemotePlatformClientDeps["loadConfig"]>,
    opts: RemoteConnectCommandOptions,
  ): string => {
    const explicitOrigin = normalizeOptionalString(opts.localOrigin);
    if (explicitOrigin) {
      return explicitOrigin.replace(/\/$/, "");
    }
    const state = this.deps.readManagedServiceState?.();
    if (
      state &&
      this.deps.isProcessRunning?.(state.pid) &&
      Number.isFinite(state.uiPort)
    ) {
      return `http://127.0.0.1:${state.uiPort}`;
    }
    const configuredPort =
      typeof config.ui?.port === "number" && Number.isFinite(config.ui.port)
        ? config.ui.port
        : 55667;
    return `http://127.0.0.1:${configuredPort}`;
  };

  private resolveDisplayName = (
    config: ReturnType<RemotePlatformClientDeps["loadConfig"]>,
    opts: RemoteConnectCommandOptions,
  ): string => {
    return (
      normalizeOptionalString(opts.name) ??
      normalizeOptionalString(config.remote.deviceName) ??
      hostname()
    );
  };
}
