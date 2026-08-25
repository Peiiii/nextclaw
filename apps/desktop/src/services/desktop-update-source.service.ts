import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type DesktopReleaseChannel,
  type DesktopLauncherStateStore,
  normalizeDesktopReleaseChannel
} from "../launcher/stores/launcher-state.store";
import type { DesktopUpdateManifestSource } from "../launcher/services/update.service";

export type GitHubPublishTarget = {
  owner: string;
  repo: string;
};

export type PackagedSeedBundleMetadata = {
  version: string;
  sha256: string;
  archiveBytes: number;
  fileCount: number;
  directoryCount: number;
  uncompressedBytes: number;
};

type DesktopUpdateSourceServiceOptions = {
  isPackaged: boolean;
  appPath: string;
  resourcesPath: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  arch?: string;
  publishTarget: GitHubPublishTarget | null;
  stateStore: DesktopLauncherStateStore;
};

type PackagedReleaseMetadata = {
  channel: DesktopReleaseChannel;
  releaseTag: string | null;
  manifestBaseUrl: string | null;
  seedBundle: PackagedSeedBundleMetadata | null;
};

const RELEASE_METADATA_FILE_NAME = "update-release-metadata.json";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalPositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function normalizePackagedSeedBundleMetadata(value: unknown): PackagedSeedBundleMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const version = normalizeOptionalString(record.version);
  const sha256 = normalizeOptionalString(record.sha256);
  const archiveBytes = normalizeOptionalPositiveNumber(record.archiveBytes);
  const fileCount = normalizeOptionalPositiveNumber(record.fileCount);
  const directoryCount = normalizeOptionalPositiveNumber(record.directoryCount);
  const uncompressedBytes = normalizeOptionalPositiveNumber(record.uncompressedBytes);
  if (!version || !sha256 || archiveBytes === null || fileCount === null || directoryCount === null || uncompressedBytes === null) {
    return null;
  }
  return {
    version,
    sha256,
    archiveBytes,
    fileCount,
    directoryCount,
    uncompressedBytes
  };
}

export function getDesktopUpdateManifestAssetName(
  channel: DesktopReleaseChannel,
  platform: NodeJS.Platform,
  arch: string
): string {
  return `manifest-${channel}-${platform}-${arch}.json`;
}

export function getDesktopUpdateChannelManifestUrl(
  publishTarget: GitHubPublishTarget,
  channel: DesktopReleaseChannel,
  platform: NodeJS.Platform,
  arch: string
): string {
  return `https://${publishTarget.owner}.github.io/${publishTarget.repo}/desktop-updates/${channel}/${getDesktopUpdateManifestAssetName(channel, platform, arch)}`;
}

export function getDesktopUpdateChannelManifestUrlFromBaseUrl(
  baseUrl: string,
  channel: DesktopReleaseChannel,
  platform: NodeJS.Platform,
  arch: string
): string {
  return new URL(`${channel}/${getDesktopUpdateManifestAssetName(channel, platform, arch)}`, `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

export class DesktopUpdateSourceService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;

  constructor(private readonly options: DesktopUpdateSourceServiceOptions) {
    this.env = options.env ?? process.env;
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
  }

  resolveChannel = (): DesktopReleaseChannel => {
    const envChannel = normalizeOptionalString(this.env.NEXTCLAW_DESKTOP_UPDATE_CHANNEL);
    if (envChannel) {
      return normalizeDesktopReleaseChannel(envChannel);
    }
    if (this.options.stateStore.hasStateFile()) {
      return this.options.stateStore.read().channel;
    }
    return this.readPackagedReleaseMetadata().channel;
  };

  resolveManifestUrl = async (): Promise<string | null> => {
    return (await this.resolveManifestSources())[0]?.url ?? null;
  };

  resolveManifestSources = async (): Promise<DesktopUpdateManifestSource[]> => {
    const channel = this.resolveChannel();
    const explicitManifestUrl = normalizeOptionalString(this.env.NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL);
    if (explicitManifestUrl) {
      return [{ channel, url: explicitManifestUrl }];
    }
    const explicitManifestBaseUrl = normalizeOptionalString(this.env.NEXTCLAW_DESKTOP_UPDATE_MANIFEST_BASE_URL);
    if (explicitManifestBaseUrl) {
      return this.buildManifestSources(channel, (sourceChannel) =>
        this.buildChannelManifestUrlFromBaseUrl(explicitManifestBaseUrl, sourceChannel)
      );
    }
    const packagedMetadataBaseUrl = this.readPackagedReleaseMetadata().manifestBaseUrl;
    if (packagedMetadataBaseUrl) {
      return this.buildManifestSources(channel, (sourceChannel) =>
        this.buildChannelManifestUrlFromBaseUrl(packagedMetadataBaseUrl, sourceChannel)
      );
    }
    const publishTarget = this.options.publishTarget;
    if (!this.options.isPackaged || !publishTarget) {
      return [];
    }

    return this.buildManifestSources(channel, (sourceChannel) =>
      this.buildChannelManifestUrl(publishTarget, sourceChannel)
    );
  };

  ensureStateChannelInitialized = async (): Promise<DesktopReleaseChannel> => {
    const channel = this.resolveChannel();
    if (!this.options.stateStore.hasStateFile()) {
      await this.options.stateStore.update((state) => ({
        ...state,
        channel
      }));
    }
    return channel;
  };

  resolvePackagedSeedBundleMetadata = (): PackagedSeedBundleMetadata | null => {
    return this.readPackagedReleaseMetadata().seedBundle;
  };

  private readPackagedReleaseMetadata = (): PackagedReleaseMetadata => {
    const metadataPath = this.options.isPackaged
      ? join(this.options.resourcesPath, "update", RELEASE_METADATA_FILE_NAME)
      : resolve(this.options.appPath, "build", RELEASE_METADATA_FILE_NAME);
    if (!existsSync(metadataPath)) {
      return {
        channel: "stable",
        releaseTag: null,
        manifestBaseUrl: null,
        seedBundle: null
      };
    }

    const parsed = JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
    return {
      channel: normalizeDesktopReleaseChannel(normalizeOptionalString(parsed.channel)),
      releaseTag: normalizeOptionalString(parsed.releaseTag),
      manifestBaseUrl: normalizeOptionalString(parsed.manifestBaseUrl),
      seedBundle: normalizePackagedSeedBundleMetadata(parsed.seedBundle)
    };
  };

  private buildChannelManifestUrl = (
    publishTarget: GitHubPublishTarget,
    channel: DesktopReleaseChannel
  ): string => {
    return getDesktopUpdateChannelManifestUrl(publishTarget, channel, this.platform, this.arch);
  };

  private buildChannelManifestUrlFromBaseUrl = (
    baseUrl: string,
    channel: DesktopReleaseChannel
  ): string => {
    return getDesktopUpdateChannelManifestUrlFromBaseUrl(baseUrl, channel, this.platform, this.arch);
  };

  private buildManifestSources = (
    channel: DesktopReleaseChannel,
    resolveUrl: (sourceChannel: DesktopReleaseChannel) => string
  ): DesktopUpdateManifestSource[] => {
    const sourceChannels: DesktopReleaseChannel[] = channel === "beta" ? ["beta", "stable"] : ["stable"];
    return sourceChannels.map((sourceChannel) => ({
      channel: sourceChannel,
      url: resolveUrl(sourceChannel)
    }));
  };
}
