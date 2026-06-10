import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type NpmRuntimeReleaseChannel = "stable" | "beta";

const DEFAULT_NPM_RUNTIME_UPDATE_BASE_URL = "https://Peiiii.github.io/nextclaw/npm-runtime-updates";

type NpmRuntimeUpdateSourceServiceOptions = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  arch?: string;
  packagedPublicKeyPath?: string;
};

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeChannel(value: unknown): NpmRuntimeReleaseChannel {
  return typeof value === "string" && value.trim().toLowerCase() === "beta" ? "beta" : "stable";
}

export function inferDefaultNpmRuntimeReleaseChannel(launcherVersion?: string | null): NpmRuntimeReleaseChannel {
  return typeof launcherVersion === "string" && launcherVersion.toLowerCase().includes("-beta") ? "beta" : "stable";
}

function resolvePackagedPublicKeyPath(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDir, "..", "resources", "update-bundle-public.pem"),
    resolve(moduleDir, "../../..", "resources", "update-bundle-public.pem"),
    resolve(moduleDir, "../../../..", "resources", "update-bundle-public.pem")
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export class NpmRuntimeUpdateSourceService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly packagedPublicKeyPath?: string;

  constructor(options: NpmRuntimeUpdateSourceServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.packagedPublicKeyPath = options.packagedPublicKeyPath;
  }

  resolveChannel = (explicitChannel?: unknown, launcherVersion?: string | null): NpmRuntimeReleaseChannel => {
    if (explicitChannel !== undefined || this.env.NEXTCLAW_UPDATE_CHANNEL !== undefined) {
      return normalizeChannel(explicitChannel ?? this.env.NEXTCLAW_UPDATE_CHANNEL);
    }
    return inferDefaultNpmRuntimeReleaseChannel(launcherVersion);
  };

  resolveManifestUrl = (channel: NpmRuntimeReleaseChannel, explicitManifestUrl?: unknown): string | null => {
    const manifestUrl = normalizeOptionalString(explicitManifestUrl) ?? normalizeOptionalString(this.env.NEXTCLAW_UPDATE_MANIFEST_URL);
    if (manifestUrl) {
      return manifestUrl;
    }
    const baseUrl = normalizeOptionalString(this.env.NEXTCLAW_UPDATE_MANIFEST_BASE_URL) ?? DEFAULT_NPM_RUNTIME_UPDATE_BASE_URL;
    return new URL(`${channel}/manifest-${channel}-${this.platform}-${this.arch}.json`, `${baseUrl.replace(/\/+$/, "")}/`).toString();
  };

  resolveBundlePublicKey = (): string | null => {
    const explicitPublicKey = normalizeOptionalString(this.env.NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY);
    if (explicitPublicKey) {
      return explicitPublicKey;
    }
    const publicKeyPath = normalizeOptionalString(this.env.NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY_PATH);
    if (!publicKeyPath || !existsSync(publicKeyPath)) {
      const packagedPublicKeyPath = this.packagedPublicKeyPath ?? resolvePackagedPublicKeyPath();
      return existsSync(packagedPublicKeyPath) ? readFileSync(packagedPublicKeyPath, "utf8").trim() : null;
    }
    return readFileSync(publicKeyPath, "utf8").trim();
  };
}
