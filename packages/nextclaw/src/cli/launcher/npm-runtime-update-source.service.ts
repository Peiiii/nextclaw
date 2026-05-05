import { existsSync, readFileSync } from "node:fs";

export type NpmRuntimeReleaseChannel = "stable" | "beta";

type NpmRuntimeUpdateSourceServiceOptions = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  arch?: string;
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

export class NpmRuntimeUpdateSourceService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;

  constructor(options: NpmRuntimeUpdateSourceServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
  }

  resolveChannel = (explicitChannel?: unknown): NpmRuntimeReleaseChannel => {
    return normalizeChannel(explicitChannel ?? this.env.NEXTCLAW_UPDATE_CHANNEL);
  };

  resolveManifestUrl = (channel: NpmRuntimeReleaseChannel, explicitManifestUrl?: unknown): string | null => {
    const manifestUrl = normalizeOptionalString(explicitManifestUrl) ?? normalizeOptionalString(this.env.NEXTCLAW_UPDATE_MANIFEST_URL);
    if (manifestUrl) {
      return manifestUrl;
    }
    const baseUrl = normalizeOptionalString(this.env.NEXTCLAW_UPDATE_MANIFEST_BASE_URL);
    if (!baseUrl) {
      return null;
    }
    return new URL(`${channel}/manifest-${channel}-${this.platform}-${this.arch}.json`, `${baseUrl.replace(/\/+$/, "")}/`).toString();
  };

  resolveBundlePublicKey = (): string | null => {
    const explicitPublicKey = normalizeOptionalString(this.env.NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY);
    if (explicitPublicKey) {
      return explicitPublicKey;
    }
    const publicKeyPath = normalizeOptionalString(this.env.NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY_PATH);
    if (!publicKeyPath || !existsSync(publicKeyPath)) {
      return null;
    }
    return readFileSync(publicKeyPath, "utf8").trim();
  };
}
