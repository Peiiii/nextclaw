import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { BrowserConnectorConfig } from "@/types/browser-connector.types.js";
import { resolveBrowserConnectorIpcPath } from "@/utils/ipc-path.utils.js";
import { resolveBrowserConnectorExtensionDir } from "@/utils/package-path.utils.js";
import { BrowserConnectorError } from "@/types/cli-output.types.js";

const DEFAULT_NATIVE_HOST_NAME = "com.nextclaw.browserconnector";
const DEFAULT_EXTENSION_ID = "pbpjjfnofpmgofhghjnfceiljmbdgieb";

type StoredBrowserConnectorConfig = {
  nativeHostName?: string;
  extensionId?: string;
};

export class ConfigRepository {
  constructor(private readonly providedHomeDir?: string) {}

  readConfig = async (): Promise<BrowserConnectorConfig> => {
    const homeDir = this.resolveHomeDir();
    const stored = await this.readStoredConfig(homeDir);
    const nativeHostName = stored.nativeHostName ?? DEFAULT_NATIVE_HOST_NAME;
    const extensionId = stored.extensionId ?? DEFAULT_EXTENSION_ID;

    return {
      homeDir,
      nativeHostName,
      extensionId,
      extensionDir: this.resolveExtensionDir(),
      ipcPath: resolveBrowserConnectorIpcPath(homeDir),
    };
  };

  writeConfig = async (
    patch: Partial<StoredBrowserConnectorConfig>,
  ): Promise<BrowserConnectorConfig> => {
    const homeDir = this.resolveHomeDir();
    const current = await this.readStoredConfig(homeDir);
    const next = { ...current, ...patch };
    const configPath = this.resolveConfigPath(homeDir);
    const tempConfigPath = `${configPath}.tmp`;
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(tempConfigPath, JSON.stringify(next, null, 2));
    await rename(tempConfigPath, configPath);
    return this.readConfig();
  };

  private readStoredConfig = async (
    homeDir: string,
  ): Promise<StoredBrowserConnectorConfig> => {
    try {
      const raw = await readFile(this.resolveConfigPath(homeDir), "utf8");
      const parsed = JSON.parse(raw) as StoredBrowserConnectorConfig;
      return parsed;
    } catch (error) {
      if (isMissingFileError(error)) {
        return {};
      }

      throw new BrowserConnectorError(
        "CONFIG_INVALID",
        `Browser Connector config is invalid under ${homeDir}. Fix or remove config.json, then rerun the command.`,
      );
    }
  };

  private resolveHomeDir = (): string =>
    this.providedHomeDir ??
    process.env.BROWSER_CONNECTOR_HOME ??
    join(homedir(), ".browser-connector");

  private resolveConfigPath = (homeDir: string): string =>
    join(homeDir, "config.json");

  private resolveExtensionDir = (): string =>
    resolveBrowserConnectorExtensionDir(import.meta.url);
}

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === "ENOENT";
