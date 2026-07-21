import {
  createRemoteInstanceSystemDomain,
  getRemoteInstanceDomainByKind,
  getRemoteInstanceDomainByPrefix,
  releaseExpiredRemoteInstanceCustomDomain,
  releaseRemoteInstanceCustomDomain,
  setRemoteInstanceCustomDomain,
} from "@/repositories/remote-instance-domain.repository";
import { getRemoteInstanceById } from "@/repositories/remote-instance.repository";
import type { RemoteInstanceRow } from "@/types/platform";

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED_DOMAIN_PREFIXES = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "cdn",
  "docs",
  "mail",
  "platform",
  "remote",
  "static",
  "status",
  "www",
]);

export type RemoteInstanceDomainClaimResult =
  | { ok: true; instance: RemoteInstanceRow }
  | { ok: false; reason: "invalid" | "reserved" | "taken" };

function normalizeDomain(value: string | null | undefined): string | null {
  const normalized =
    value
      ?.trim()
      .toLowerCase()
      .replace(/^\.+|\.+$/g, "") ?? "";
  return normalized || null;
}

function readConfiguredFixedPrefix(
  baseDomain: string | null,
  fixedDomain: string | null,
): string | null {
  if (!baseDomain || !fixedDomain || !fixedDomain.endsWith(`.${baseDomain}`)) {
    return null;
  }
  const prefix = fixedDomain.slice(0, -(baseDomain.length + 1));
  return prefix && !prefix.includes(".") ? prefix : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint|sqlite_constraint/i.test(message);
}

export class RemoteInstanceDomainService {
  private readonly baseDomain: string | null;
  private readonly fixedDomainPrefix: string | null;

  constructor(
    private readonly db: D1Database,
    options: {
      baseDomain?: string | null;
      fixedDomain?: string | null;
      now?: () => Date;
    } = {},
  ) {
    this.baseDomain = normalizeDomain(options.baseDomain);
    this.fixedDomainPrefix = readConfiguredFixedPrefix(
      this.baseDomain,
      normalizeDomain(options.fixedDomain),
    );
    this.now = options.now ?? (() => new Date());
  }

  private readonly now: () => Date;

  buildDomain = (prefix: string | null): string | null => {
    return prefix && this.baseDomain ? `${prefix}.${this.baseDomain}` : null;
  };

  ensureSystemDomain = async (
    instanceId: string,
    claimedAt: string,
  ): Promise<void> => {
    if (await getRemoteInstanceDomainByKind(this.db, instanceId, "system")) {
      return;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const prefix = `i-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
      try {
        await createRemoteInstanceSystemDomain(this.db, {
          instanceId,
          prefix,
          claimedAt,
        });
        return;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        if (
          await getRemoteInstanceDomainByKind(this.db, instanceId, "system")
        ) {
          return;
        }
      }
    }
    throw new Error("Failed to allocate a unique remote instance domain.");
  };

  claimCustom = async (
    instance: RemoteInstanceRow,
    requestedPrefix: string,
  ): Promise<RemoteInstanceDomainClaimResult> => {
    const domainPrefix = normalizeDomain(requestedPrefix);
    if (!domainPrefix || !DOMAIN_LABEL_PATTERN.test(domainPrefix)) {
      return { ok: false, reason: "invalid" };
    }
    if (
      domainPrefix.startsWith("r-") ||
      domainPrefix.startsWith("i-") ||
      domainPrefix.startsWith("nc-") ||
      RESERVED_DOMAIN_PREFIXES.has(domainPrefix) ||
      domainPrefix === this.fixedDomainPrefix
    ) {
      return { ok: false, reason: "reserved" };
    }
    if (
      instance.custom_domain_prefix === domainPrefix &&
      !this.isExpired(instance.custom_domain_expires_at)
    ) {
      return { ok: true, instance };
    }

    const nowIso = this.now().toISOString();
    const currentHolder = await getRemoteInstanceDomainByPrefix(
      this.db,
      domainPrefix,
    );
    if (currentHolder && currentHolder.instance_id !== instance.id) {
      const released =
        currentHolder.kind === "custom" &&
        this.isExpired(currentHolder.expires_at)
          ? await releaseExpiredRemoteInstanceCustomDomain(this.db, {
              prefix: domainPrefix,
              nowIso,
            })
          : false;
      if (!released) {
        return { ok: false, reason: "taken" };
      }
    }

    try {
      await setRemoteInstanceCustomDomain(this.db, {
        instanceId: instance.id,
        prefix: domainPrefix,
        claimedAt: nowIso,
        expiresAt: null,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { ok: false, reason: "taken" };
      }
      throw error;
    }

    const updated = await getRemoteInstanceById(this.db, instance.id);
    if (!updated) {
      throw new Error(
        "Remote instance disappeared while updating its domain claim.",
      );
    }
    return { ok: true, instance: updated };
  };

  releaseCustom = async (
    instance: RemoteInstanceRow,
  ): Promise<RemoteInstanceRow> => {
    if (instance.custom_domain_prefix) {
      await releaseRemoteInstanceCustomDomain(this.db, instance.id);
    }
    const updated = await getRemoteInstanceById(this.db, instance.id);
    if (!updated) {
      throw new Error(
        "Remote instance disappeared while releasing its custom domain.",
      );
    }
    return updated;
  };

  private isExpired = (expiresAt: string | null): boolean => {
    return Boolean(expiresAt && Date.parse(expiresAt) <= this.now().getTime());
  };
}
