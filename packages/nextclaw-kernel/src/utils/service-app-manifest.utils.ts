import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ServiceActionRisk,
  ServiceAppManifest,
  ServiceAppManifestAction,
} from "@kernel/types/service-app.types.js";

const SERVICE_APP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SERVICE_ACTION_RISKS = new Set<ServiceActionRisk>([
  "read",
  "write",
  "external",
  "dangerous",
]);

export const SERVICE_APP_MANIFEST_FILE_NAME = "service-app.json";

export function getServiceAppManifestPath(dirPath: string): string {
  return join(dirPath, SERVICE_APP_MANIFEST_FILE_NAME);
}

export async function readServiceAppManifest(
  dirPath: string,
): Promise<ServiceAppManifest> {
  return parseServiceAppManifest(
    await readFile(getServiceAppManifestPath(dirPath), "utf8"),
  );
}

export function parseServiceAppManifest(raw: string): ServiceAppManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `service-app.json is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!isRecord(parsed)) {
    throw new Error("service-app.json must contain an object.");
  }

  const id = readRequiredString(parsed, "id");
  if (!SERVICE_APP_ID_PATTERN.test(id)) {
    throw new Error("service app id must be kebab-case.");
  }

  const protocol = readOptionalString(parsed, "protocol") ?? "mcp";
  if (protocol !== "mcp") {
    throw new Error("service app protocol must be mcp.");
  }

  return {
    id,
    title: readRequiredString(parsed, "title"),
    description: readOptionalString(parsed, "description"),
    enabled: readOptionalBoolean(parsed, "enabled") ?? true,
    protocol,
    command: readRequiredString(parsed, "command"),
    args: readStringArray(parsed.args, "args"),
    actions: readManifestActions(parsed.actions),
  };
}

function readManifestActions(value: unknown): Record<string, ServiceAppManifestAction> {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error("service app actions must be an object.");
  }

  const actions: Record<string, ServiceAppManifestAction> = {};
  for (const [name, action] of Object.entries(value)) {
    if (!name.trim()) {
      throw new Error("service app action name cannot be empty.");
    }
    if (!isRecord(action)) {
      throw new Error(`service app action ${name} must be an object.`);
    }
    const risk = readOptionalString(action, "risk");
    if (risk !== undefined && !SERVICE_ACTION_RISKS.has(risk as ServiceActionRisk)) {
      throw new Error(`service app action ${name} has invalid risk.`);
    }
    actions[name] = {
      risk: risk as ServiceActionRisk | undefined,
    };
  }
  return actions;
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = readOptionalString(record, key);
  if (!value) {
    throw new Error(`service app ${key} is required.`);
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof record[key] === "string" && record[key].trim()
    ? record[key].trim()
    : undefined;
}

function readOptionalBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | undefined {
  if (record[key] === undefined) {
    return undefined;
  }
  if (typeof record[key] !== "boolean") {
    throw new Error(`service app ${key} must be boolean.`);
  }
  return record[key];
}

function readStringArray(value: unknown, key: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`service app ${key} must be a string array.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
