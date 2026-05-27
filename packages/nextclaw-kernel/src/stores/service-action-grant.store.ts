import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  ServiceActionCaller,
  ServiceActionGrant,
  ServiceActionRisk,
} from "@kernel/types/service-app.types.js";
import {
  getServiceActionCallerKey,
  parseServiceActionCallerKey,
} from "@kernel/utils/service-action.utils.js";

type StoredServiceActionGrant = {
  grantedAt: string;
  risk: ServiceActionRisk;
};

type ServiceActionGrantStoreData = {
  version: 1;
  grants: Record<string, {
    actions: Record<string, StoredServiceActionGrant>;
  }>;
};

const EMPTY_GRANTS: ServiceActionGrantStoreData = {
  version: 1,
  grants: {},
};

export class ServiceActionGrantStore {
  constructor(private readonly storePath: string) {}

  isGranted = async (
    caller: ServiceActionCaller,
    actionId: string,
  ): Promise<boolean> => {
    const data = await this.load();
    return Boolean(data.grants[getServiceActionCallerKey(caller)]?.actions[actionId]);
  };

  grant = async ({
    actionId,
    caller,
    grantedAt,
    risk,
  }: {
    caller: ServiceActionCaller;
    actionId: string;
    risk: ServiceActionRisk;
    grantedAt: string;
  }): Promise<ServiceActionGrant> => {
    const data = await this.load();
    const callerKey = getServiceActionCallerKey(caller);
    const callerGrants = data.grants[callerKey] ?? { actions: {} };
    callerGrants.actions[actionId] = {
      grantedAt,
      risk,
    };
    data.grants[callerKey] = callerGrants;
    await this.save(data);
    return {
      caller,
      actionId,
      risk,
      grantedAt,
    };
  };

  list = async (): Promise<ServiceActionGrant[]> => {
    const data = await this.load();
    return Object.entries(data.grants).flatMap(([callerKey, callerGrants]) => {
      const caller = parseServiceActionCallerKey(callerKey);
      if (!caller) {
        return [];
      }
      return Object.entries(callerGrants.actions).map(([actionId, grant]) => ({
        caller,
        actionId,
        risk: grant.risk,
        grantedAt: grant.grantedAt,
      }));
    }).sort((left, right) =>
      new Date(right.grantedAt).getTime() - new Date(left.grantedAt).getTime()
    );
  };

  revoke = async (
    caller: ServiceActionCaller,
    actionId: string,
  ): Promise<void> => {
    const data = await this.load();
    const callerKey = getServiceActionCallerKey(caller);
    const callerGrants = data.grants[callerKey];
    if (!callerGrants) {
      return;
    }
    delete callerGrants.actions[actionId];
    if (Object.keys(callerGrants.actions).length === 0) {
      delete data.grants[callerKey];
    }
    await this.save(data);
  };

  private load = async (): Promise<ServiceActionGrantStoreData> => {
    try {
      return normalizeStoreData(JSON.parse(await readFile(this.storePath, "utf8")));
    } catch (error) {
      if (isMissingFileError(error)) {
        return structuredClone(EMPTY_GRANTS);
      }
      throw error;
    }
  };

  private save = async (data: ServiceActionGrantStoreData): Promise<void> => {
    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  };
}

function normalizeStoreData(value: unknown): ServiceActionGrantStoreData {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.grants)) {
    return structuredClone(EMPTY_GRANTS);
  }
  const grants: ServiceActionGrantStoreData["grants"] = {};
  for (const [callerKey, callerValue] of Object.entries(value.grants)) {
    if (!isRecord(callerValue) || !isRecord(callerValue.actions)) {
      continue;
    }
    const actions: Record<string, StoredServiceActionGrant> = {};
    for (const [actionId, actionValue] of Object.entries(callerValue.actions)) {
      if (
        isRecord(actionValue) &&
        typeof actionValue.grantedAt === "string" &&
        isServiceActionRisk(actionValue.risk)
      ) {
        actions[actionId] = {
          grantedAt: actionValue.grantedAt,
          risk: actionValue.risk,
        };
      }
    }
    grants[callerKey] = { actions };
  }
  return { version: 1, grants };
}

function isServiceActionRisk(value: unknown): value is ServiceActionRisk {
  return (
    value === "read" ||
    value === "write" ||
    value === "external" ||
    value === "dangerous"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
