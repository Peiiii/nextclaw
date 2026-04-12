import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type DesktopReleaseChannel = "stable" | "beta";

export type GitHubPublishTarget = {
  owner: string;
  repo: string;
};

type GitHubReleaseAsset = {
  name?: unknown;
  browser_download_url?: unknown;
};

type GitHubRelease = {
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
};

type DesktopUpdateSourceServiceOptions = {
  isPackaged: boolean;
  appPath: string;
  resourcesPath: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  arch?: string;
  publishTarget: GitHubPublishTarget | null;
  fetchImpl?: typeof fetch;
};

type PackagedReleaseMetadata = {
  channel: DesktopReleaseChannel;
  releaseTag: string | null;
};

const RELEASE_METADATA_FILE_NAME = "update-release-metadata.json";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isGitHubReleaseAsset(value: unknown): value is GitHubReleaseAsset {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGitHubRelease(value: unknown): value is GitHubRelease {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDesktopReleaseChannel(value: string | null | undefined): DesktopReleaseChannel {
  return value?.trim().toLowerCase() === "beta" ? "beta" : "stable";
}

export function getDesktopUpdateManifestAssetName(
  channel: DesktopReleaseChannel,
  platform: NodeJS.Platform,
  arch: string
): string {
  return `manifest-${channel}-${platform}-${arch}.json`;
}

export class DesktopUpdateSourceService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: DesktopUpdateSourceServiceOptions) {
    this.env = options.env ?? process.env;
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  resolveChannel = (): DesktopReleaseChannel => {
    const envChannel = normalizeOptionalString(this.env.NEXTCLAW_DESKTOP_UPDATE_CHANNEL);
    if (envChannel) {
      return normalizeDesktopReleaseChannel(envChannel);
    }
    return this.readPackagedReleaseMetadata().channel;
  };

  resolveManifestUrl = async (): Promise<string | null> => {
    const explicitManifestUrl = normalizeOptionalString(this.env.NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL);
    if (explicitManifestUrl) {
      return explicitManifestUrl;
    }
    if (!this.options.isPackaged || !this.options.publishTarget) {
      return null;
    }

    const channel = this.resolveChannel();
    if (channel === "stable") {
      return this.buildStableManifestUrl(this.options.publishTarget);
    }
    return await this.resolveLatestBetaManifestUrl(this.options.publishTarget);
  };

  private readPackagedReleaseMetadata = (): PackagedReleaseMetadata => {
    const metadataPath = this.options.isPackaged
      ? join(this.options.resourcesPath, "update", RELEASE_METADATA_FILE_NAME)
      : resolve(this.options.appPath, "build", RELEASE_METADATA_FILE_NAME);
    if (!existsSync(metadataPath)) {
      return {
        channel: "stable",
        releaseTag: null
      };
    }

    const parsed = JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
    return {
      channel: normalizeDesktopReleaseChannel(normalizeOptionalString(parsed.channel)),
      releaseTag: normalizeOptionalString(parsed.releaseTag)
    };
  };

  private buildStableManifestUrl = (publishTarget: GitHubPublishTarget): string => {
    const manifestName = getDesktopUpdateManifestAssetName("stable", this.platform, this.arch);
    return `https://github.com/${publishTarget.owner}/${publishTarget.repo}/releases/latest/download/${manifestName}`;
  };

  private resolveLatestBetaManifestUrl = async (publishTarget: GitHubPublishTarget): Promise<string> => {
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${publishTarget.owner}/${publishTarget.repo}/releases?per_page=20`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "NextClaw-Desktop-Updater"
        }
      }
    );
    if (!response.ok) {
      throw new Error(`desktop beta release lookup failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new Error("desktop beta release lookup returned an invalid payload");
    }

    const expectedManifestName = getDesktopUpdateManifestAssetName("beta", this.platform, this.arch);
    const matchingRelease = payload.find((entry) => {
      if (!isGitHubRelease(entry)) {
        return false;
      }
      if (entry.draft === true || entry.prerelease !== true || !Array.isArray(entry.assets)) {
        return false;
      }
      return entry.assets.some((asset) => {
        if (!isGitHubReleaseAsset(asset)) {
          return false;
        }
        return asset.name === expectedManifestName;
      });
    });
    if (!matchingRelease || !Array.isArray(matchingRelease.assets)) {
      throw new Error(`No beta desktop update manifest is available for ${this.platform}-${this.arch}.`);
    }

    const manifestAsset = matchingRelease.assets.find((asset: unknown) => {
      if (!isGitHubReleaseAsset(asset)) {
        return false;
      }
      return asset.name === expectedManifestName;
    });
    const downloadUrl =
      manifestAsset && isGitHubReleaseAsset(manifestAsset)
        ? normalizeOptionalString(manifestAsset.browser_download_url)
        : null;
    if (!downloadUrl) {
      throw new Error(`Beta desktop update manifest asset is missing a download URL for ${this.platform}-${this.arch}.`);
    }
    return downloadUrl;
  };
}
