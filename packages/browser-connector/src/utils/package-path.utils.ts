import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "@nextclaw/browser-connector";

export const resolveBrowserConnectorPackageRoot = (
  startUrl: string,
): string => {
  let currentDir = dirname(fileURLToPath(startUrl));

  while (currentDir !== dirname(currentDir)) {
    const packageJsonPath = join(currentDir, "package.json");

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name?: unknown;
      };

      if (packageJson.name === PACKAGE_NAME) {
        return currentDir;
      }
    }

    currentDir = dirname(currentDir);
  }

  throw new Error(`Unable to locate ${PACKAGE_NAME} package root.`);
};

export const resolveBrowserConnectorPackageVersion = (
  startUrl: string,
): string => {
  const packageJsonPath = join(
    resolveBrowserConnectorPackageRoot(startUrl),
    "package.json",
  );
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: unknown;
  };

  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
};

export const resolveBrowserConnectorExtensionDir = (
  startUrl: string,
): string => {
  const packageRoot = resolveBrowserConnectorPackageRoot(startUrl);
  const distExtensionDir = join(packageRoot, "dist/extension");

  if (existsSync(distExtensionDir)) {
    return distExtensionDir;
  }

  return join(packageRoot, "resources/extension");
};

export const resolveNativeHostLauncherPath = (startUrl: string): string => {
  const packageRoot = resolveBrowserConnectorPackageRoot(startUrl);
  return join(packageRoot, "dist/app/native-host-launcher.js");
};
