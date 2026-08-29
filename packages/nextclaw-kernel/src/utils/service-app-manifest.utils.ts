import { readFile } from "node:fs/promises";
import { join } from "node:path";
import path from "node:path";
import {
  AppServiceLaunchService,
  type AppNativeArtifactTarget,
  type AppPlatformTargetService,
} from "@nextclaw/app-runtime";
import type {
  ServiceActionRisk,
  ServiceAppExternalRemediation,
  ServiceAppProvides,
  ServiceAppLifecycle,
  ServiceAppManifest,
  ServiceAppManifestAction,
  ServiceAppRequirements,
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
  options?: ServiceAppManifestParseOptions,
): Promise<ServiceAppManifest> {
  return parseServiceAppManifest(
    await readFile(getServiceAppManifestPath(dirPath), "utf8"),
    options,
  );
}

type ServiceAppManifestParseOptions = {
  target?: AppNativeArtifactTarget;
  platformTargetService?: AppPlatformTargetService;
};

export function parseServiceAppManifest(
  raw: string,
  options: ServiceAppManifestParseOptions = {},
): ServiceAppManifest {
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
  if (protocol !== "mcp" && protocol !== "wasi-component") {
    throw new Error("service app protocol must be mcp or wasi-component.");
  }

  const launch = protocol === "mcp"
    ? new AppServiceLaunchService(options.platformTargetService).resolve(parsed, options.target)
    : undefined;
  const componentEntry = protocol === "wasi-component"
    ? readPortableComponentEntry(parsed)
    : undefined;
  const lifecycle = readServiceAppLifecycle(parsed.lifecycle);
  if (lifecycle.mode !== "action" && protocol !== "wasi-component") {
    throw new Error(`${lifecycle.mode} service app lifecycle requires wasi-component protocol.`);
  }
  const provides = readServiceAppProvides(parsed.provides);
  if (provides && lifecycle.mode !== "provider") {
    throw new Error("service app provides requires provider lifecycle.");
  }
  return {
    id,
    title: readRequiredString(parsed, "title"),
    description: readOptionalString(parsed, "description"),
    enabled: readOptionalBoolean(parsed, "enabled") ?? true,
    protocol,
    command: launch?.command,
    args: launch?.args,
    componentEntry,
    providerIds: readProviderIds(parsed.providers),
    lifecycle,
    requires: readServiceAppRequirements(parsed.requires),
    provides,
    actions: readManifestActions(parsed.actions),
  };
}

function readServiceAppProvides(value: unknown): ServiceAppProvides | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error("service app provides must be an object.");
  }
  if (value.capabilities === undefined) return undefined;
  if (!Array.isArray(value.capabilities)) {
    throw new Error("service app provides.capabilities must be an array.");
  }
  const seen = new Set<string>();
  const capabilities = value.capabilities.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`service app provides.capabilities[${index}] must be an object.`);
    }
    const id = readRequirementIdentifier(entry, "id", `provides.capabilities[${index}].id`);
    const version = readOptionalString(entry, "version");
    if (!version) {
      throw new Error(`service app provides.capabilities[${index}].version is required.`);
    }
    const key = `${id}@${version}`;
    if (seen.has(key)) {
      throw new Error(`service app provides.capabilities contains duplicate ${key}.`);
    }
    seen.add(key);
    const resourceTypes = readCapabilityResourceTypes(entry.resourceTypes, index);
    return { id, version, resourceTypes };
  });
  return capabilities.length > 0 ? { capabilities } : undefined;
}

function readCapabilityResourceTypes(value: unknown, index: number): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`service app provides.capabilities[${index}].resourceTypes must be an array.`);
  }
  const resourceTypes = value.map((entry, resourceIndex) => {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new Error(
        `service app provides.capabilities[${index}].resourceTypes[${resourceIndex}] must be a lowercase identifier.`,
      );
    }
    return entry.trim();
  });
  if (resourceTypes.some((entry) => !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(entry))) {
    throw new Error(`service app provides.capabilities[${index}].resourceTypes must contain lowercase identifiers.`);
  }
  return Array.from(new Set(resourceTypes));
}

function readServiceAppRequirements(value: unknown): ServiceAppRequirements | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error("service app requires must be an object.");
  }
  const capabilities = readCapabilityRequirements(value.capabilities);
  const resources = readResourceRequirements(value.resources);
  return capabilities || resources ? { capabilities, resources } : undefined;
}

function readCapabilityRequirements(
  value: unknown,
): ServiceAppRequirements["capabilities"] {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("service app requires.capabilities must be an array.");
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`service app requires.capabilities[${index}] must be an object.`);
    }
    const id = readRequirementIdentifier(entry, "id", `requires.capabilities[${index}].id`);
    const version = readOptionalString(entry, "version");
    const key = `${id}@${version ?? "*"}`;
    if (seen.has(key)) {
      throw new Error(`service app requires.capabilities contains duplicate ${key}.`);
    }
    seen.add(key);
    return {
      id,
      version,
      title: readOptionalString(entry, "title"),
      description: readOptionalString(entry, "description"),
      remediation: readExternalRemediation(entry.remediation, `requires.capabilities[${index}]`),
    };
  });
}

function readResourceRequirements(
  value: unknown,
): ServiceAppRequirements["resources"] {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("service app requires.resources must be an array.");
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`service app requires.resources[${index}] must be an object.`);
    }
    const binding = readRequirementIdentifier(entry, "binding", `requires.resources[${index}].binding`);
    if (seen.has(binding)) {
      throw new Error(`service app requires.resources contains duplicate binding ${binding}.`);
    }
    seen.add(binding);
    return {
      binding,
      type: readRequirementIdentifier(entry, "type", `requires.resources[${index}].type`),
      required: readOptionalBoolean(entry, "required") ?? true,
      title: readOptionalString(entry, "title"),
      description: readOptionalString(entry, "description"),
      remediation: readExternalRemediation(entry.remediation, `requires.resources[${index}]`),
    };
  });
}

function readRequirementIdentifier(
  record: Record<string, unknown>,
  key: string,
  fieldName: string,
): string {
  const value = readOptionalString(record, key);
  if (!value || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value)) {
    throw new Error(`service app ${fieldName} must be a lowercase identifier.`);
  }
  return value;
}

function readExternalRemediation(
  value: unknown,
  fieldPrefix: string,
): ServiceAppExternalRemediation | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || value.kind !== "agent-setup") {
    throw new Error(`service app ${fieldPrefix}.remediation.kind must be agent-setup.`);
  }
  const summary = readOptionalString(value, "summary");
  if (!summary) {
    throw new Error(`service app ${fieldPrefix}.remediation.summary is required.`);
  }
  return {
    kind: "agent-setup",
    summary,
    requiresUserAction: readOptionalBoolean(value, "requiresUserAction"),
  };
}

function readServiceAppLifecycle(value: unknown): ServiceAppLifecycle {
  if (value === undefined) return { mode: "action" };
  if (!isRecord(value)) {
    throw new Error("service app lifecycle must be an object.");
  }
  const mode = readOptionalString(value, "mode") ?? "action";
  if (mode === "action") return { mode };
  if (mode === "provider") return { mode };
  if (mode !== "resident") {
    throw new Error("service app lifecycle.mode must be action, resident or provider.");
  }
  const eventIntervalMs = readOptionalNumber(value, "eventIntervalMs");
  if (
    eventIntervalMs === undefined ||
    !Number.isInteger(eventIntervalMs) ||
    eventIntervalMs < 250 ||
    eventIntervalMs > 60_000
  ) {
    throw new Error(
      "resident service app lifecycle.eventIntervalMs must be an integer between 250 and 60000.",
    );
  }
  return { mode, eventIntervalMs };
}

function readProviderIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("service app providers must be an array.");
  }
  const providerIds = value.map((entry) => {
    if (typeof entry !== "string" || !SERVICE_APP_ID_PATTERN.test(entry.trim())) {
      throw new Error("service app providers must contain kebab-case service app ids.");
    }
    return entry.trim();
  });
  return Array.from(new Set(providerIds));
}

function readPortableComponentEntry(record: Record<string, unknown>): string {
  const component = record.component;
  if (!isRecord(component)) {
    throw new Error("service app component is required for wasi-component.");
  }
  const entry = readRequiredString(component, "entry").replace(/\\/g, "/");
  if (path.isAbsolute(entry) || entry.includes("\0") || entry.split("/").includes("..")) {
    throw new Error("service app component.entry must be a package-relative path.");
  }
  if (!entry.endsWith(".wasm")) {
    throw new Error("service app component.entry must reference a .wasm file.");
  }
  return entry;
}

function readManifestActions(value: unknown): Record<string, ServiceAppManifestAction> {
  if (value === undefined) {
    throw new Error("service app actions are required.");
  }
  if (!isRecord(value)) {
    throw new Error("service app actions must be an object.");
  }
  if (Object.keys(value).length === 0) {
    throw new Error("service app actions cannot be empty.");
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
    const inputSchema = action.inputSchema;
    if (inputSchema !== undefined && !isRecord(inputSchema)) {
      throw new Error(`service app action ${name} inputSchema must be an object.`);
    }
    const timeoutMs = readOptionalNumber(action, "timeoutMs");
    if (
      timeoutMs !== undefined &&
      (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000)
    ) {
      throw new Error(
        `service app action ${name} timeoutMs must be an integer between 100 and 300000.`,
      );
    }
    actions[name] = {
      risk: risk as ServiceActionRisk | undefined,
      title: readOptionalString(action, "title"),
      description: readOptionalString(action, "description"),
      inputSchema,
      timeoutMs,
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

function readOptionalNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  if (record[key] === undefined) {
    return undefined;
  }
  if (typeof record[key] !== "number") {
    throw new Error(`service app ${key} must be number.`);
  }
  return record[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
