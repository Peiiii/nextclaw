import { createHash } from "node:crypto";
import { access, chmod, lstat, readFile, readdir, readlink, rm } from "node:fs/promises";
import path from "node:path";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import type { AppRegistryInstalledVersion } from "#app-runtime/types/app-registry.types.js";

export class AppInstallationIntegrityService {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
  ) {}

  calculateDigest = async (installDirectory: string): Promise<string> => {
    const digest = createHash("sha256");
    const visit = async (directory: string): Promise<void> => {
      const entries = (await readdir(directory, { withFileTypes: true }))
        .sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        const relativePath = path.relative(installDirectory, entryPath).replace(/\\/g, "/");
        digest.update(relativePath);
        digest.update("\0");
        if (entry.isSymbolicLink()) {
          digest.update(`link:${await readlink(entryPath)}`);
          digest.update("\0");
          continue;
        }
        if (entry.isDirectory()) {
          digest.update("directory\0");
          await visit(entryPath);
          continue;
        }
        if (!entry.isFile()) {
          throw new Error(`应用版本目录只允许普通文件、目录或符号链接：${relativePath}`);
        }
        digest.update("file\0");
        digest.update(await readFile(entryPath));
        digest.update("\0");
      }
    };
    await visit(path.resolve(installDirectory));
    return digest.digest("hex");
  };

  assertVersion = async (params: {
    appId: string;
    version: string;
    versionRecord: AppRegistryInstalledVersion;
  }): Promise<string> => {
    const { appId, version, versionRecord } = params;
    const targetManifest = await this.manifestService.load(versionRecord.installDirectory);
    if (
      targetManifest.manifest.id !== appId ||
      targetManifest.manifest.version !== version
    ) {
      throw new Error(`应用 ${appId}@${version} manifest 身份校验失败。`);
    }
    const contentSha256 = await this.calculateDigest(versionRecord.installDirectory);
    if (versionRecord.contentSha256 && contentSha256 !== versionRecord.contentSha256) {
      throw new Error(
        `应用 ${appId}@${version} 代码完整性校验失败，已阻止激活。请重新安装该版本。`,
      );
    }
    return contentSha256;
  };

  protectDirectory = async (installDirectory: string): Promise<void> => {
    const protect = async (targetPath: string): Promise<void> => {
      const stats = await lstat(targetPath);
      if (stats.isSymbolicLink()) {
        return;
      }
      if (stats.isDirectory()) {
        for (const entry of await readdir(targetPath)) {
          await protect(path.join(targetPath, entry));
        }
        return;
      }
      await chmod(targetPath, stats.mode & ~0o222);
    };
    await protect(path.resolve(installDirectory));
  };

  removeDirectory = async (directory: string): Promise<void> => {
    if (!await this.pathExists(directory)) {
      return;
    }
    const makeWritable = async (targetPath: string): Promise<void> => {
      const stats = await lstat(targetPath);
      if (stats.isSymbolicLink()) {
        return;
      }
      await chmod(targetPath, stats.mode | 0o200 | (stats.isDirectory() ? 0o700 : 0));
      if (stats.isDirectory()) {
        for (const entry of await readdir(targetPath)) {
          await makeWritable(path.join(targetPath, entry));
        }
      }
    };
    await makeWritable(directory);
    await rm(directory, { recursive: true, force: true });
  };

  pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  };
}
