import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEFAULT_PANELS_DIR, DEFAULT_SERVICE_APPS_DIR } from "@nextclaw/core";
import type { CapabilityGrantManager } from "@kernel/features/capability-grants/managers/capability-grant.manager.js";
import type { CapabilityGrant } from "@kernel/features/capability-grants/types/capability-grant.types.js";
import {
  createPanelAppAgentGrantRequest,
  createPanelAppClientGrantRequest,
} from "@kernel/features/capability-grants/utils/capability-grant-resource.utils.js";
import { createCapabilityDeclarationFingerprint } from "@kernel/features/capability-grants/utils/capability-grant.utils.js";
import { isPanelAppAgentCapability } from "@kernel/types/panel-app.types.js";
import type { ServiceActionRisk } from "@kernel/types/service-app.types.js";
import { parseServiceActionCallerKey } from "@kernel/utils/service-action.utils.js";

const PANEL_AGENT_GRANTS_FILE_NAME = ".panel-app-capability-grants.json";
const PANEL_CLIENT_GRANTS_FILE_NAME = ".panel-app-client-grants.json";
const SERVICE_ACTION_GRANTS_FILE_NAME = ".service-action-grants.json";

type LegacyGrantSource = {
  path: string;
  parse: (value: unknown) => CapabilityGrant[];
};

type ExistingLegacyGrantSource = {
  content: string;
  path: string;
  grants: CapabilityGrant[];
};

export class CapabilityGrantLegacyMigrationService {
  private readonly sources: LegacyGrantSource[];

  constructor(private readonly params: {
    capabilityGrantManager: CapabilityGrantManager;
    markerPath: string;
    validateGrant: (grant: CapabilityGrant) => Promise<boolean>;
    workspacePath: string;
  }) {
    const panelsPath = join(params.workspacePath, DEFAULT_PANELS_DIR);
    const serviceAppsPath = join(params.workspacePath, DEFAULT_SERVICE_APPS_DIR);
    this.sources = [
      {
        path: join(panelsPath, PANEL_AGENT_GRANTS_FILE_NAME),
        parse: parsePanelAgentGrants,
      },
      {
        path: join(panelsPath, PANEL_CLIENT_GRANTS_FILE_NAME),
        parse: parsePanelClientGrants,
      },
      {
        path: join(serviceAppsPath, SERVICE_ACTION_GRANTS_FILE_NAME),
        parse: parseServiceActionGrants,
      },
    ];
  }

  migrate = async (): Promise<void> => {
    const existingSources = await this.readSources();
    if (existingSources.length === 0) return;

    const originalGrants = await this.params.capabilityGrantManager.list();
    const originalMarker = await readOptionalFile(this.params.markerPath);
    const deletedSources: ExistingLegacyGrantSource[] = [];
    try {
      const validatedGrants: CapabilityGrant[] = [];
      for (const grant of existingSources.flatMap((source) => source.grants)) {
        if (await this.params.validateGrant(grant)) validatedGrants.push(grant);
      }
      await this.params.capabilityGrantManager.import(validatedGrants);
      await this.assertImported(validatedGrants);
      await writeFileAtomically(this.params.markerPath, `${JSON.stringify({
        version: 1,
        migratedAt: new Date().toISOString(),
        importedGrantCount: validatedGrants.length,
      }, null, 2)}\n`);
      for (const source of existingSources) {
        await rm(source.path);
        deletedSources.push(source);
      }
    } catch (error) {
      const recoveryErrors = await this.restore({
        deletedSources,
        originalGrants,
        originalMarker,
      });
      if (recoveryErrors.length > 0) {
        throw new AggregateError(
          [error, ...recoveryErrors],
          "Capability grant legacy migration failed and recovery was incomplete.",
        );
      }
      throw error;
    }
  };

  private readSources = async (): Promise<ExistingLegacyGrantSource[]> => {
    const existingSources: ExistingLegacyGrantSource[] = [];
    for (const source of this.sources) {
      const content = await readOptionalFile(source.path);
      if (content === null) continue;
      existingSources.push({
        content,
        path: source.path,
        grants: source.parse(JSON.parse(content)),
      });
    }
    return existingSources;
  };

  private assertImported = async (grants: CapabilityGrant[]): Promise<void> => {
    for (const grant of grants) {
      if (!(await this.params.capabilityGrantManager.check(grant)).granted) {
        throw new Error("Capability grant legacy migration verification failed.");
      }
    }
  };

  private restore = async (params: {
    deletedSources: ExistingLegacyGrantSource[];
    originalGrants: CapabilityGrant[];
    originalMarker: string | null;
  }): Promise<unknown[]> => {
    const errors: unknown[] = [];
    for (const source of params.deletedSources) {
      try {
        await writeFileAtomically(source.path, source.content);
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await this.params.capabilityGrantManager.replace(params.originalGrants);
    } catch (error) {
      errors.push(error);
    }
    try {
      if (params.originalMarker === null) {
        await rm(this.params.markerPath, { force: true });
      } else {
        await writeFileAtomically(this.params.markerPath, params.originalMarker);
      }
    } catch (error) {
      errors.push(error);
    }
    return errors;
  };
}

function parsePanelClientGrants(value: unknown): CapabilityGrant[] {
  const grants = readLegacyGrantRecord(value, "Panel App client grant store");
  return Object.entries(grants).map(([appId, grant]) => {
    requireNonEmptyString(appId, "Panel App client grant app id");
    const record = requireRecord(grant, "Panel App client grant");
    assertExactKeys(record, ["grantedAt"], "Panel App client grant");
    return {
      ...createPanelAppClientGrantRequest(appId),
      grantedAt: requireNonEmptyString(record.grantedAt, "Panel App client grant grantedAt"),
    };
  });
}

function parsePanelAgentGrants(value: unknown): CapabilityGrant[] {
  const grants = readLegacyGrantRecord(value, "Panel App agent grant store");
  return Object.entries(grants).flatMap(([callerKey, callerGrant]) => {
    const caller = parsePanelCallerKey(callerKey);
    const callerRecord = requireRecord(callerGrant, "Panel App agent caller grant");
    assertExactKeys(callerRecord, ["capabilities"], "Panel App agent caller grant");
    const capabilities = requireRecord(
      callerRecord.capabilities,
      "Panel App agent capability grants",
    );
    return Object.entries(capabilities).map(([capability, grant]) => {
      if (!isPanelAppAgentCapability(capability)) {
        throw new Error(`Panel App agent grant capability is unsupported: ${capability}`);
      }
      const record = requireRecord(grant, "Panel App agent capability grant");
      assertExactKeys(record, ["grantedAt"], "Panel App agent capability grant");
      return {
        ...createPanelAppAgentGrantRequest(caller, capability),
        grantedAt: requireNonEmptyString(
          record.grantedAt,
          "Panel App agent capability grant grantedAt",
        ),
      };
    });
  });
}

function parseServiceActionGrants(value: unknown): CapabilityGrant[] {
  const grants = readLegacyGrantRecord(value, "Service Action grant store");
  return Object.entries(grants).flatMap(([callerKey, callerGrant]) => {
    const caller = parseServiceActionCallerKey(callerKey);
    if (!caller) throw new Error(`Service Action grant caller is invalid: ${callerKey}`);
    const callerRecord = requireRecord(callerGrant, "Service Action caller grant");
    assertExactKeys(callerRecord, ["actions"], "Service Action caller grant");
    const actions = requireRecord(callerRecord.actions, "Service Action grants");
    return Object.entries(actions).map(([actionId, grant]) => {
      requireNonEmptyString(actionId, "Service Action grant action id");
      const record = requireRecord(grant, "Service Action grant");
      assertExactKeys(record, ["grantedAt", "risk"], "Service Action grant");
      const risk = requireServiceActionRisk(record.risk);
      return {
        subject: {
          type: caller.surface,
          id: caller.surface === "panel-app" ? caller.appId : caller.agentId,
        },
        resource: { type: "service.action", target: { actionId } },
        access: ["invoke"],
        declarationFingerprint: createCapabilityDeclarationFingerprint({
          id: actionId,
          risk,
        }),
        grantedAt: requireNonEmptyString(record.grantedAt, "Service Action grant grantedAt"),
      };
    });
  });
}

function readLegacyGrantRecord(value: unknown, label: string): Record<string, unknown> {
  const record = requireRecord(value, label);
  assertExactKeys(record, ["grants", "version"], label);
  if (record.version !== 1) throw new Error(`${label} version is unsupported.`);
  return requireRecord(record.grants, `${label} grants`);
}

function parsePanelCallerKey(key: string): {
  surface: "panel-app";
  appId: string;
} {
  const [surface, appId, ...rest] = key.split(":");
  if (surface !== "panel-app" || !appId || rest.length > 0) {
    throw new Error(`Panel App agent grant caller is invalid: ${key}`);
  }
  return { surface, appId };
}

function requireServiceActionRisk(value: unknown): ServiceActionRisk {
  if (value === "read" || value === "write" || value === "external" || value === "dangerous") {
    return value;
  }
  throw new Error("Service Action grant risk is invalid.");
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is invalid.`);
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: string[],
  label: string,
): void {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} schema is invalid.`);
  }
}

async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

async function writeFileAtomically(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" &&
    (error as { code?: unknown }).code === "ENOENT";
}
