import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export class AppHomeService {
  constructor(
    private readonly appHomeDirectory: string = process.env.NEXTCLAW_APP_HOME
      ? path.resolve(process.env.NEXTCLAW_APP_HOME)
      : path.join(process.env.HOME ?? process.cwd(), ".nextclaw", "apps"),
  ) {}

  getAppHomeDirectory = (): string => {
    return this.appHomeDirectory;
  };

  getPackagesDirectory = (): string => {
    return path.join(this.appHomeDirectory, "packages");
  };

  getDataDirectory = (): string => {
    return path.join(this.appHomeDirectory, "data");
  };

  getRegistryPath = (): string => {
    return path.join(this.appHomeDirectory, "registry.json");
  };

  getConfigPath = (): string => {
    return path.join(this.appHomeDirectory, "config.json");
  };

  getInstallDirectory = (appId: string, version: string): string => {
    return path.join(this.getPackagesDirectory(), appId, version);
  };

  getAppDataDirectory = (appId: string): string => {
    return path.join(this.getDataDirectory(), appId);
  };

  ensureBaseDirectories = async (): Promise<void> => {
    await Promise.all([
      mkdir(this.appHomeDirectory, { recursive: true }),
      mkdir(this.getPackagesDirectory(), { recursive: true }),
      mkdir(this.getDataDirectory(), { recursive: true }),
    ]);
  };

  createTemporaryDirectory = async (prefix: string): Promise<string> => {
    return mkdtemp(path.join(tmpdir(), prefix));
  };
}
