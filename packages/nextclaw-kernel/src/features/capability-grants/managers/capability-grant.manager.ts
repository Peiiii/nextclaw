import type {
  CapabilityGrant,
  CapabilityGrantDecision,
  CapabilityGrantFilter,
  CapabilityGrantRequest,
} from "@kernel/features/capability-grants/types/capability-grant.types.js";
import { CapabilityGrantStore } from "@kernel/features/capability-grants/stores/capability-grant.store.js";
import {
  capabilityGrantCovers,
  getCapabilityGrantKey,
  matchesCapabilityGrantFilter,
  normalizeCapabilityGrantRequest,
} from "@kernel/features/capability-grants/utils/capability-grant.utils.js";

export type CapabilityGrantListener = (grants: CapabilityGrant[]) => void | Promise<void>;
export type CapabilityGrantRevocationListener = CapabilityGrantListener;

export class CapabilityGrantManager {
  private readonly store: CapabilityGrantStore;
  private readonly grantListeners = new Set<CapabilityGrantListener>();
  private readonly revocationListeners = new Set<CapabilityGrantRevocationListener>();

  constructor(storePath: string) {
    this.store = new CapabilityGrantStore(storePath);
  }

  check = async (request: CapabilityGrantRequest): Promise<CapabilityGrantDecision> => {
    const normalized = normalizeCapabilityGrantRequest(request);
    const grant = (await this.store.read()).find((entry) => capabilityGrantCovers(entry, normalized));
    return grant ? { granted: true, grant } : { granted: false, reason: "authorization_required" };
  };

  require = async (request: CapabilityGrantRequest): Promise<CapabilityGrant> => {
    const decision = await this.check(request);
    if (!decision.granted) {
      const error = new Error("Capability authorization is required.");
      Object.assign(error, { code: decision.reason, request: normalizeCapabilityGrantRequest(request) });
      throw error;
    }
    return decision.grant;
  };

  grant = async (
    request: CapabilityGrantRequest,
    grantedAt = new Date().toISOString(),
  ): Promise<CapabilityGrant> => {
    const normalized = normalizeCapabilityGrantRequest(request);
    const grant: CapabilityGrant = { ...normalized, grantedAt };
    await this.store.mutateGrants((grants) => [
      ...grants.filter((entry) => getCapabilityGrantKey(entry) !== getCapabilityGrantKey(normalized)),
      grant,
    ]);
    await Promise.all([...this.grantListeners].map(async (listener) => await listener([grant])));
    return grant;
  };

  list = async (filter: CapabilityGrantFilter = {}): Promise<CapabilityGrant[]> =>
    (await this.store.read()).filter((grant) => matchesCapabilityGrantFilter(grant, filter));

  revoke = async (filter: CapabilityGrantFilter): Promise<CapabilityGrant[]> =>
    await this.revokeMatching((grant) => matchesCapabilityGrantFilter(grant, filter));

  revokeMatching = async (
    matches: (grant: CapabilityGrant) => boolean,
  ): Promise<CapabilityGrant[]> => {
    const revoked = (await this.store.read()).filter(matches);
    if (revoked.length === 0) return [];
    const revokedKeys = new Set(revoked.map(getCapabilityGrantKey));
    await this.store.mutateGrants((grants) => grants.filter((grant) => !revokedKeys.has(getCapabilityGrantKey(grant))));
    await Promise.all([...this.revocationListeners].map(async (listener) => await listener(revoked)));
    return revoked;
  };

  import = async (grants: CapabilityGrant[]): Promise<void> => {
    await this.store.mutateGrants((existing) => {
      const merged = new Map(existing.map((grant) => [getCapabilityGrantKey(grant), grant]));
      for (const grant of grants) merged.set(getCapabilityGrantKey(grant), grant);
      return [...merged.values()];
    });
  };

  replace = async (grants: CapabilityGrant[]): Promise<void> => {
    await this.store.replace(grants);
  };

  onGranted = (listener: CapabilityGrantListener): (() => void) => {
    this.grantListeners.add(listener);
    return () => this.grantListeners.delete(listener);
  };

  onRevoked = (listener: CapabilityGrantRevocationListener): (() => void) => {
    this.revocationListeners.add(listener);
    return () => this.revocationListeners.delete(listener);
  };
}
