import {
  getRemoteInstanceById,
  getRemoteInstanceByInstallId,
  migrateRemoteInstanceInstallId,
  upsertRemoteInstance,
} from "@/repositories/remote-instance.repository";
import type { RemoteInstanceDomainService } from "@/services/remote-instance-domain.service";
import type { RemoteInstanceRow } from "@/types/platform";

export type RemoteInstanceRegistrationInput = {
  instanceInstallId: string;
  legacyInstanceInstallId: string;
  displayName: string;
  platform: string;
  appVersion: string;
  localOrigin: string;
  nowIso: string;
};

export type RemoteInstanceRegistrationResult =
  | { ok: true; before: RemoteInstanceRow | null; instance: RemoteInstanceRow }
  | { ok: false; reason: "owned" | "persistence" };

export class RemoteInstanceRegistrationService {
  constructor(
    private readonly db: D1Database,
    private readonly userId: string,
    private readonly domains: RemoteInstanceDomainService,
  ) {}

  register = async (
    input: RemoteInstanceRegistrationInput,
  ): Promise<RemoteInstanceRegistrationResult> => {
    let existing = await getRemoteInstanceByInstallId(
      this.db,
      input.instanceInstallId,
    );
    if (existing && existing.user_id !== this.userId) {
      return { ok: false, reason: "owned" };
    }

    const migrated = existing ? null : await this.migrateLegacyInstance(input);
    existing = existing ?? migrated?.instance ?? null;
    if (existing && existing.user_id !== this.userId) {
      return { ok: false, reason: "owned" };
    }

    const instanceId = existing?.id ?? crypto.randomUUID();
    await upsertRemoteInstance(this.db, {
      id: instanceId,
      userId: this.userId,
      instanceInstallId: input.instanceInstallId,
      displayName: input.displayName,
      platform: input.platform,
      appVersion: input.appVersion,
      localOrigin: input.localOrigin,
      status: "offline",
      lastSeenAt: input.nowIso,
    });
    await this.domains.ensureSystemDomain(instanceId, input.nowIso);

    const instance = await getRemoteInstanceById(this.db, instanceId);
    if (instance) {
      return { ok: true, before: migrated?.before ?? existing, instance };
    }
    const identityOwner = await getRemoteInstanceByInstallId(
      this.db,
      input.instanceInstallId,
    );
    return { ok: false, reason: identityOwner ? "owned" : "persistence" };
  };

  private migrateLegacyInstance = async (
    input: RemoteInstanceRegistrationInput,
  ): Promise<{
    before: RemoteInstanceRow;
    instance: RemoteInstanceRow;
  } | null> => {
    if (
      !input.legacyInstanceInstallId ||
      input.legacyInstanceInstallId === input.instanceInstallId
    ) {
      return null;
    }
    const legacy = await getRemoteInstanceByInstallId(
      this.db,
      input.legacyInstanceInstallId,
    );
    if (!legacy || legacy.user_id !== this.userId) {
      return null;
    }
    try {
      await migrateRemoteInstanceInstallId(this.db, {
        instanceId: legacy.id,
        legacyInstallId: input.legacyInstanceInstallId,
        instanceInstallId: input.instanceInstallId,
        updatedAt: input.nowIso,
      });
    } catch (error) {
      const raced = await getRemoteInstanceByInstallId(
        this.db,
        input.instanceInstallId,
      );
      if (!raced) throw error;
      return { before: legacy, instance: raced };
    }
    const instance = await getRemoteInstanceByInstallId(
      this.db,
      input.instanceInstallId,
    );
    return instance ? { before: legacy, instance } : null;
  };
}
