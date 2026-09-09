import { InvalidArgumentError } from "commander";
import {
  createLocalUiApiClient,
  type UiApiClient,
} from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";

export function requireConfigApiClient(): UiApiClient {
  const client = createLocalUiApiClient();
  if (!client) throw new Error("NextClaw is not running. Run nextclaw start before managing providers, models or search.");
  return client;
}

export function printConfigResult(value: unknown): void {
  // Provider views already hide API keys; custom headers can also contain credentials.
  process.stdout.write(`${JSON.stringify(value, (key, item: unknown) => {
    if (key === "extraHeaders" && item && typeof item === "object") {
      return Object.fromEntries(Object.keys(item).map((name) => [name, "[redacted]"]));
    }
    return item;
  }, 2)}\n`);
}

export function parseConfigBoolean(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new InvalidArgumentError("Expected true or false.");
}

export function collectConfigOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function parseConfigAssignment(value: string): [string, string] {
  const separator = value.indexOf("=");
  if (separator < 1 || !value.slice(0, separator).trim() || separator === value.length - 1) {
    throw new InvalidArgumentError("Expected name=value.");
  }
  return [value.slice(0, separator).trim(), value.slice(separator + 1)];
}

export function readConfigApiKey(options: { apiKeyEnv?: string; clearApiKey?: boolean }): string | null | undefined {
  const { apiKeyEnv, clearApiKey } = options;
  if (apiKeyEnv && clearApiKey) throw new Error("Choose --api-key-env or --clear-api-key, not both.");
  if (clearApiKey) return null;
  if (!apiKeyEnv) return undefined;
  const value = process.env[apiKeyEnv];
  if (!value?.trim()) throw new Error(`Environment variable ${apiKeyEnv} is empty or missing.`);
  return value;
}

export function requireConfigChange(patch: object): void {
  if (Object.keys(patch).length === 0) throw new Error("No changes specified. See command --help for supported options.");
}
