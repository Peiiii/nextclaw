import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  PanelAppCapabilityGrant,
  PanelAppCapabilityGrantCaller,
  PanelAppAgentCapability,
} from "@kernel/types/panel-app.types.js";

type StoredPanelAppCapabilityGrant = {
  grantedAt: string;
};

type PanelAppCapabilityGrantStoreData = {
  version: 1;
  grants: Record<string, {
    capabilities: Record<string, StoredPanelAppCapabilityGrant>;
  }>;
};

const EMPTY_GRANTS: PanelAppCapabilityGrantStoreData = {
  version: 1,
  grants: {},
};

export class PanelAppCapabilityGrantStore {
  constructor(private readonly filePath: string) {}

  isGranted = async (
    caller: PanelAppCapabilityGrantCaller,
    capability: PanelAppAgentCapability,
  ): Promise<boolean> => {
    const data = await this.load();
    return Boolean(data.grants[getCallerKey(caller)]?.capabilities[capability]);
  };

  grant = async (params: {
    caller: PanelAppCapabilityGrantCaller;
    capability: PanelAppAgentCapability;
    grantedAt: string;
  }): Promise<PanelAppCapabilityGrant> => {
    const { caller, capability, grantedAt } = params;
    const data = await this.load();
    const callerKey = getCallerKey(caller);
    const callerGrants = data.grants[callerKey] ?? { capabilities: {} };
    callerGrants.capabilities[capability] = {
      grantedAt,
    };
    data.grants[callerKey] = callerGrants;
    await this.save(data);
    return {
      caller,
      capability,
      grantedAt,
    };
  };

  private load = async (): Promise<PanelAppCapabilityGrantStoreData> => {
    try {
      return normalizeStoreData(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if (isMissingFileError(error)) {
        return structuredClone(EMPTY_GRANTS);
      }
      throw error;
    }
  };

  private save = async (data: PanelAppCapabilityGrantStoreData): Promise<void> => {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  };
}

function normalizeStoreData(value: unknown): PanelAppCapabilityGrantStoreData {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.grants)) {
    return structuredClone(EMPTY_GRANTS);
  }
  const grants: PanelAppCapabilityGrantStoreData["grants"] = {};
  for (const [callerKey, callerValue] of Object.entries(value.grants)) {
    if (!isRecord(callerValue) || !isRecord(callerValue.capabilities)) {
      continue;
    }
    const capabilities: Record<string, StoredPanelAppCapabilityGrant> = {};
    for (const [capability, grantValue] of Object.entries(callerValue.capabilities)) {
      if (isRecord(grantValue) && typeof grantValue.grantedAt === "string") {
        capabilities[capability] = { grantedAt: grantValue.grantedAt };
      }
    }
    grants[callerKey] = { capabilities };
  }
  return { version: 1, grants };
}

function getCallerKey(caller: PanelAppCapabilityGrantCaller): string {
  return `${caller.surface}:${caller.appId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error) &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "ENOENT";
}
