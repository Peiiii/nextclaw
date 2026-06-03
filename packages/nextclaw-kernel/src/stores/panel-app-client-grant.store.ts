import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type StoredPanelAppClientGrant = {
  grantedAt: string;
};

type PanelAppClientGrantStoreData = {
  version: 1;
  grants: Record<string, StoredPanelAppClientGrant>;
};

const EMPTY_GRANTS: PanelAppClientGrantStoreData = {
  grants: {},
  version: 1,
};

export type PanelAppClientGrant = {
  appId: string;
  grantedAt: string;
};

export class PanelAppClientGrantStore {
  constructor(private readonly filePath: string) {}

  isGranted = async (appId: string): Promise<boolean> => {
    const data = await this.load();
    return Boolean(data.grants[appId]);
  };

  grant = async (params: PanelAppClientGrant): Promise<PanelAppClientGrant> => {
    const data = await this.load();
    data.grants[params.appId] = {
      grantedAt: params.grantedAt,
    };
    await this.save(data);
    return params;
  };

  revoke = async (appId: string): Promise<void> => {
    const data = await this.load();
    if (!data.grants[appId]) {
      return;
    }
    delete data.grants[appId];
    await this.save(data);
  };

  private load = async (): Promise<PanelAppClientGrantStoreData> => {
    try {
      return normalizeStoreData(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if (isMissingFileError(error)) {
        return structuredClone(EMPTY_GRANTS);
      }
      throw error;
    }
  };

  private save = async (data: PanelAppClientGrantStoreData): Promise<void> => {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  };
}

function normalizeStoreData(value: unknown): PanelAppClientGrantStoreData {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.grants)) {
    return structuredClone(EMPTY_GRANTS);
  }
  const grants: Record<string, StoredPanelAppClientGrant> = {};
  for (const [appId, grant] of Object.entries(value.grants)) {
    if (isRecord(grant) && typeof grant.grantedAt === "string") {
      grants[appId] = { grantedAt: grant.grantedAt };
    }
  }
  return { grants, version: 1 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
