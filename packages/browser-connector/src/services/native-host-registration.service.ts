import { execFile } from "node:child_process";
import { access, chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import type { BrowserConnectorConfig } from "@/types/browser-connector.types.js";
import { BrowserConnectorError } from "@/types/cli-output.types.js";
import { resolveNativeHostLauncherPath } from "@/utils/package-path.utils.js";

export type NativeHostInstallResult = {
  nativeHostName: string;
  manifestPath: string;
  hostPath: string;
  extensionId: string;
  extensionDir: string;
};

export type NativeHostStatusResult = NativeHostInstallResult & {
  installed: boolean;
};

export class NativeHostRegistrationService {
  install = async (
    config: BrowserConnectorConfig,
  ): Promise<NativeHostInstallResult> => {
    const manifestPath = this.resolveManifestPath(config.nativeHostName);
    const hostPath = await this.resolveNativeHostExecutablePath(config);
    await assertFileExists(hostPath, "Native host executable");
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          name: config.nativeHostName,
          description: "Browser Connector Native Host",
          path: hostPath,
          type: "stdio",
          allowed_origins: [`chrome-extension://${config.extensionId}/`],
        },
        null,
        2,
      ),
    );
    await this.registerWindowsHost(config.nativeHostName, manifestPath);

    return {
      nativeHostName: config.nativeHostName,
      manifestPath,
      hostPath,
      extensionId: config.extensionId,
      extensionDir: config.extensionDir,
    };
  };

  uninstall = async (
    config: BrowserConnectorConfig,
  ): Promise<NativeHostInstallResult> => {
    const manifestPath = this.resolveManifestPath(config.nativeHostName);
    const hostPath = await this.resolveNativeHostExecutablePath(config);
    await rm(manifestPath, { force: true });
    await rm(this.resolveGeneratedHostExecutablePath(config), { force: true });
    await this.unregisterWindowsHost(config.nativeHostName);

    return {
      nativeHostName: config.nativeHostName,
      manifestPath,
      hostPath,
      extensionId: config.extensionId,
      extensionDir: config.extensionDir,
    };
  };

  status = async (
    config: BrowserConnectorConfig,
  ): Promise<NativeHostStatusResult> => {
    const manifestPath = this.resolveManifestPath(config.nativeHostName);
    const hostPath = this.resolveNativeHostExecutablePathWithoutWrite(config);

    return {
      nativeHostName: config.nativeHostName,
      manifestPath,
      hostPath,
      extensionId: config.extensionId,
      extensionDir: config.extensionDir,
      installed: await fileExists(manifestPath),
    };
  };

  private resolveManifestPath = (hostName: string): string => {
    if (process.env.BROWSER_CONNECTOR_CHROME_NATIVE_HOST_DIR) {
      return join(
        process.env.BROWSER_CONNECTOR_CHROME_NATIVE_HOST_DIR,
        `${hostName}.json`,
      );
    }

    if (process.platform === "darwin") {
      return join(
        homedir(),
        "Library/Application Support/Google/Chrome/NativeMessagingHosts",
        `${hostName}.json`,
      );
    }

    if (process.platform === "linux") {
      return join(
        homedir(),
        ".config/google-chrome/NativeMessagingHosts",
        `${hostName}.json`,
      );
    }

    if (process.platform === "win32") {
      return join(
        homedir(),
        "AppData/Local/Browser Connector/NativeMessagingHosts",
        `${hostName}.json`,
      );
    }

    throw new BrowserConnectorError(
      "UNSUPPORTED_PLATFORM",
      `Unsupported platform for Native Host manifest registration: ${process.platform}.`,
    );
  };

  private resolveNativeHostExecutablePath = async (
    config: BrowserConnectorConfig,
  ): Promise<string> => {
    if (process.env.BROWSER_CONNECTOR_NATIVE_HOST_PATH) {
      return process.env.BROWSER_CONNECTOR_NATIVE_HOST_PATH;
    }

    const launcherPath = this.resolveNativeHostLauncherPath();
    await assertFileExists(launcherPath, "Native host launcher");

    const hostPath = this.resolveGeneratedHostExecutablePath(config);
    await mkdir(dirname(hostPath), { recursive: true });
    await writeFile(hostPath, this.createNativeHostWrapperScript(launcherPath));
    await chmod(hostPath, 0o755);
    return hostPath;
  };

  private resolveNativeHostExecutablePathWithoutWrite = (
    config: BrowserConnectorConfig,
  ): string =>
    process.env.BROWSER_CONNECTOR_NATIVE_HOST_PATH ??
    this.resolveGeneratedHostExecutablePath(config);

  private resolveGeneratedHostExecutablePath = (
    config: BrowserConnectorConfig,
  ): string => {
    const extension = process.platform === "win32" ? ".cmd" : "";
    return join(
      config.homeDir,
      "native-host",
      `${config.nativeHostName}${extension}`,
    );
  };

  private resolveNativeHostLauncherPath = (): string =>
    process.env.BROWSER_CONNECTOR_NATIVE_HOST_LAUNCHER_PATH ??
    resolveNativeHostLauncherPath(import.meta.url);

  private createNativeHostWrapperScript = (launcherPath: string): string => {
    if (process.platform === "win32") {
      return [
        "@echo off",
        `"${process.execPath}" "${launcherPath}"`,
        "",
      ].join("\r\n");
    }

    return [
      "#!/bin/sh",
      `exec ${shellQuote(process.execPath)} ${shellQuote(launcherPath)} "$@"`,
      "",
    ].join("\n");
  };

  private registerWindowsHost = async (
    hostName: string,
    manifestPath: string,
  ): Promise<void> => {
    if (process.platform !== "win32") {
      return;
    }

    await execFileAsync("reg", [
      "add",
      `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      manifestPath,
      "/f",
    ]);
  };

  private unregisterWindowsHost = async (hostName: string): Promise<void> => {
    if (process.platform !== "win32") {
      return;
    }

    await execFileAsync("reg", [
      "delete",
      `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`,
      "/f",
    ]);
  };
}

const execFileAsync = promisify(execFile);

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const assertFileExists = async (
  path: string,
  label: string,
): Promise<void> => {
  if (await fileExists(path)) {
    return;
  }

  throw new BrowserConnectorError(
    "FILE_WRITE_FAILED",
    `${label} does not exist at ${path}. Run browser-connector from a built package.`,
  );
};

const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
