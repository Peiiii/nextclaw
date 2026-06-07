import { randomUUID } from "node:crypto";

import type {
  BrowserTabInfo,
  BrowserTabLease,
} from "@/types/browser-connector.types.js";
import { BrowserConnectorError } from "@/types/cli-output.types.js";

type BrowserLeaseRecord = {
  leaseId: string;
  tab: BrowserTabInfo;
  expiresAtMs: number;
};

export class BrowserLeaseManager {
  private readonly leases = new Map<string, BrowserLeaseRecord>();

  constructor(private readonly ttlMs = 10 * 60 * 1000) {}

  createLease = (tab: BrowserTabInfo): BrowserTabLease => {
    this.cleanupExpiredLeases();
    const leaseId = randomUUID();
    const expiresAtMs = Date.now() + this.ttlMs;
    this.leases.set(leaseId, {
      leaseId,
      tab,
      expiresAtMs,
    });

    return {
      leaseId,
      tab,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  };

  resolveLease = (leaseId: string): BrowserTabLease => {
    this.cleanupExpiredLeases();
    const lease = this.leases.get(leaseId);

    if (!lease) {
      throw new BrowserConnectorError(
        "LEASE_NOT_FOUND",
        `Browser tab lease is not active: ${leaseId}. Run tabs list and tabs claim again.`,
        { recoverable: true },
      );
    }

    return {
      leaseId: lease.leaseId,
      tab: lease.tab,
      expiresAt: new Date(lease.expiresAtMs).toISOString(),
    };
  };

  finalizeLease = (leaseId: string): void => {
    this.leases.delete(leaseId);
  };

  countActiveLeases = (): number => {
    this.cleanupExpiredLeases();
    return this.leases.size;
  };

  private cleanupExpiredLeases = (): void => {
    const now = Date.now();

    for (const [leaseId, lease] of this.leases) {
      if (lease.expiresAtMs <= now) {
        this.leases.delete(leaseId);
      }
    }
  };
}
