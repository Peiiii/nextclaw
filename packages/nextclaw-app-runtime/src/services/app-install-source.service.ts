import { access } from "node:fs/promises";
import path from "node:path";
import type { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import type { AppRemoteRegistryClientService } from "#app-runtime/services/app-remote-registry-client.service.js";

type LocalAppSource =
  | { kind: "directory"; appDirectory: string }
  | { kind: "bundle"; bundlePath: string }
  | { kind: "missing" };

export type ResolvedAppInstallSource =
  | {
      kind: "directory";
      appDirectory: string;
      sourceRef: string;
    }
  | {
      kind: "bundle";
      bundlePath: string;
      sourceRef: string;
    }
  | {
      kind: "registry";
      sourceRef: string;
      registryResolution: Awaited<ReturnType<AppRemoteRegistryClientService["resolve"]>>;
    };

export class AppInstallSourceService {
  constructor(
    private readonly manifestService: AppManifestService,
    private readonly remoteRegistryClient: AppRemoteRegistryClientService,
  ) {}

  resolve = async (
    appSource: string,
    registryUrl?: string,
  ): Promise<ResolvedAppInstallSource> => {
    const localSource = await this.detectLocal(appSource);
    if (localSource.kind === "directory") {
      return {
        kind: "directory",
        appDirectory: localSource.appDirectory,
        sourceRef: localSource.appDirectory,
      };
    }
    if (localSource.kind === "bundle") {
      return {
        kind: "bundle",
        bundlePath: localSource.bundlePath,
        sourceRef: localSource.bundlePath,
      };
    }
    const registrySpec = this.parseRegistrySpec(appSource);
    if (!registrySpec) {
      if (this.looksLikePath(appSource)) {
        throw new Error(`本地安装源不存在：${appSource}`);
      }
      throw new Error(`无法识别安装源：${appSource}`);
    }
    const registryResolution = await this.remoteRegistryClient.resolve({
      appId: registrySpec.appId,
      version: registrySpec.version,
      registryUrl,
    });
    return {
      kind: "registry",
      sourceRef: `${registryResolution.appId}@${registryResolution.version}`,
      registryResolution,
    };
  };

  detectLocal = async (
    sourcePath: string,
    allowBundle: boolean = true,
  ): Promise<LocalAppSource> => {
    const normalizedSource = path.resolve(sourcePath);
    try {
      await access(normalizedSource);
      const manifestBundle = await this.manifestService.load(normalizedSource);
      if (manifestBundle.appDirectory) {
        return {
          kind: "directory",
          appDirectory: normalizedSource,
        };
      }
    } catch {
      if (allowBundle && normalizedSource.endsWith(".napp")) {
        try {
          await access(normalizedSource);
          return {
            kind: "bundle",
            bundlePath: normalizedSource,
          };
        } catch {
          return { kind: "missing" };
        }
      }
      return { kind: "missing" };
    }
    return { kind: "missing" };
  };

  private parseRegistrySpec = (
    appSource: string,
  ): { appId: string; version?: string } | undefined => {
    const match = /^(?<appId>[a-z0-9][a-z0-9._-]*)(?:@(?<version>[A-Za-z0-9._+-]+))?$/i.exec(
      appSource.trim(),
    );
    if (!match?.groups?.appId) {
      return undefined;
    }
    return {
      appId: match.groups.appId,
      version: match.groups.version,
    };
  };

  private looksLikePath = (appSource: string): boolean =>
    appSource.startsWith(".") ||
    appSource.startsWith("/") ||
    appSource.includes(path.sep);
}
