import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CapabilityGrant } from "@kernel/features/capability-grants/types/capability-grant.types.js";
import { getCapabilityGrantKey, normalizeCapabilityGrantRequest } from "@kernel/features/capability-grants/utils/capability-grant.utils.js";

type CapabilityGrantStoreData = {
  version: 1;
  grants: Record<string, CapabilityGrant>;
};

const EMPTY_DATA: CapabilityGrantStoreData = { version: 1, grants: {} };

export class CapabilityGrantStore {
  private writeQueue = Promise.resolve();

  constructor(private readonly storePath: string) {}

  read = async (): Promise<CapabilityGrant[]> => {
    await this.writeQueue;
    const data = await this.load();
    return Object.values(data.grants).sort((left, right) =>
      new Date(right.grantedAt).getTime() - new Date(left.grantedAt).getTime());
  };

  replace = async (grants: CapabilityGrant[]): Promise<void> => {
    await this.mutate(() => ({ version: 1, grants: toGrantRecord(grants) }));
  };

  mutateGrants = async (
    update: (grants: CapabilityGrant[]) => CapabilityGrant[],
  ): Promise<CapabilityGrant[]> => {
    let result: CapabilityGrant[] = [];
    await this.mutate(async (data) => {
      result = update(Object.values(data.grants));
      return { version: 1, grants: toGrantRecord(result) };
    });
    return result;
  };

  private mutate = async (
    operation: (data: CapabilityGrantStoreData) => CapabilityGrantStoreData | Promise<CapabilityGrantStoreData>,
  ): Promise<void> => {
    const next = this.writeQueue.then(async () => {
      const data = await operation(await this.load());
      await this.save(data);
    });
    this.writeQueue = next.catch(() => undefined);
    await next;
  };

  private load = async (): Promise<CapabilityGrantStoreData> => {
    try {
      return normalizeStoreData(JSON.parse(await readFile(this.storePath, "utf8")));
    } catch (error) {
      if (isMissingFileError(error)) return structuredClone(EMPTY_DATA);
      throw error;
    }
  };

  private save = async (data: CapabilityGrantStoreData): Promise<void> => {
    await mkdir(dirname(this.storePath), { recursive: true });
    const temporaryPath = `${this.storePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      await rename(temporaryPath, this.storePath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  };
}

function toGrantRecord(grants: CapabilityGrant[]): Record<string, CapabilityGrant> {
  return Object.fromEntries(grants.map((grant) => {
    const request = normalizeCapabilityGrantRequest(grant);
    return [getCapabilityGrantKey(request), {
      ...request,
      grantedAt: grant.grantedAt,
      ...(grant.lastUsedAt ? { lastUsedAt: grant.lastUsedAt } : {}),
    }];
  }));
}

function normalizeStoreData(value: unknown): CapabilityGrantStoreData {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.grants)) {
    throw new Error("Capability grant store is invalid.");
  }
  const grants: CapabilityGrant[] = [];
  for (const grant of Object.values(value.grants)) {
    if (!isRecord(grant) || !isRecord(grant.subject) || !isRecord(grant.resource) ||
      !Array.isArray(grant.access) || !grant.access.every((item) => typeof item === "string") ||
      typeof grant.declarationFingerprint !== "string" || typeof grant.grantedAt !== "string") {
      throw new Error("Capability grant store contains an invalid grant.");
    }
    const request = normalizeCapabilityGrantRequest({
      subject: { type: String(grant.subject.type ?? ""), id: String(grant.subject.id ?? "") },
      resource: { type: String(grant.resource.type ?? ""), target: grant.resource.target },
      access: grant.access,
      declarationFingerprint: grant.declarationFingerprint,
    });
    grants.push({
      ...request,
      grantedAt: grant.grantedAt,
      ...(typeof grant.lastUsedAt === "string" ? { lastUsedAt: grant.lastUsedAt } : {}),
    });
  }
  return { version: 1, grants: toGrantRecord(grants) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
