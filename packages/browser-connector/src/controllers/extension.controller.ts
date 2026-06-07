import type { BrowserConnectorManager } from "@/managers/browser-connector.manager.js";
import type { BrowserConnectorCommandOutput } from "@/types/cli-output.types.js";
import { BrowserConnectorError } from "@/types/cli-output.types.js";

export type ExtensionReloadOptions = {
  reason?: string;
  timeoutMs?: string | number;
};

export class ExtensionController {
  constructor(private readonly browserConnectorManager: BrowserConnectorManager) {}

  reload = async (
    options: ExtensionReloadOptions,
  ): Promise<BrowserConnectorCommandOutput> => ({
    ok: true,
    extensionReload: await this.browserConnectorManager.reloadExtension(
      required(options.reason, "--reason"),
      positiveInteger(options.timeoutMs, "--timeout-ms", 10_000),
    ),
  });
}

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      `${name} is required.`,
    );
  }

  return value;
};

const positiveInteger = (
  value: string | number | undefined,
  name: string,
  fallback: number,
): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      `${name} must be a positive integer.`,
    );
  }

  return parsed;
};
