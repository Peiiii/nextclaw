import type {
  CapabilityGrant,
  CapabilityGrantManager,
} from "@kernel/features/capability-grants/index.js";
import {
  createServiceActionGrantRequest,
  readServiceActionTargetId,
} from "@kernel/features/capability-grants/index.js";
import type {
  ServiceAction,
  ServiceActionCaller,
  ServiceActionGrant,
} from "@kernel/types/service-app.types.js";

export class ServiceActionGrantService {
  constructor(private readonly params: {
    capabilityGrantManager: CapabilityGrantManager;
    resolveAction: (actionId: string) => Promise<ServiceAction>;
  }) {}

  isGranted = async (
    caller: ServiceActionCaller,
    action: ServiceAction,
  ): Promise<boolean> =>
    (await this.params.capabilityGrantManager.check(
      createServiceActionGrantRequest(caller, action),
    )).granted;

  grant = async (
    caller: ServiceActionCaller,
    actions: ServiceAction[],
    grantedAt = new Date().toISOString(),
  ): Promise<ServiceActionGrant[]> => {
    const results: ServiceActionGrant[] = [];
    for (const action of actions) {
      const grant = await this.params.capabilityGrantManager.grant(
        createServiceActionGrantRequest(caller, action),
        grantedAt,
      );
      results.push({
        caller,
        actionId: action.id,
        risk: action.risk,
        grantedAt: grant.grantedAt,
      });
    }
    return results;
  };

  list = async (): Promise<ServiceActionGrant[]> => {
    const grants = await this.params.capabilityGrantManager.list({
      resourceType: "service.action",
    });
    const results: ServiceActionGrant[] = [];
    for (const grant of grants) {
      const actionId = readServiceActionTargetId(grant.resource.target);
      if (!actionId || grant.subject.type !== "panel-app") continue;
      try {
        const action = await this.params.resolveAction(actionId);
        results.push({
          caller: { surface: "panel-app", appId: grant.subject.id },
          actionId,
          risk: action.risk,
          grantedAt: grant.grantedAt,
        });
      } catch {
        continue;
      }
    }
    return results.sort((left, right) =>
      new Date(right.grantedAt).getTime() - new Date(left.grantedAt).getTime()
    );
  };

  revoke = async (
    caller: ServiceActionCaller,
    actionId: string,
  ): Promise<void> => {
    await this.params.capabilityGrantManager.revoke({
      subject: { type: caller.surface, id: caller.appId },
      resourceType: "service.action",
      target: { actionId },
    });
  };

  removePackageGrants = async (
    serviceIds: Set<string>,
  ): Promise<() => Promise<void>> => {
    const originalGrants = (await this.params.capabilityGrantManager.list({
      resourceType: "service.action",
    })).filter((grant) => this.belongsToService(grant, serviceIds));
    try {
      await this.params.capabilityGrantManager.revokeMatching((grant) =>
        grant.resource.type === "service.action" &&
        this.belongsToService(grant, serviceIds));
    } catch (error) {
      await this.restoreAfterFailure(originalGrants, error);
    }
    return async () => await this.params.capabilityGrantManager.import(originalGrants);
  };

  private belongsToService = (
    grant: CapabilityGrant,
    serviceIds: Set<string>,
  ): boolean => {
    const actionId = readServiceActionTargetId(grant.resource.target);
    return actionId != null && [...serviceIds].some((serviceId) =>
      actionId.startsWith(`${serviceId}.`));
  };

  private restoreAfterFailure = async (
    originalGrants: CapabilityGrant[],
    error: unknown,
  ): Promise<never> => {
    try {
      await this.params.capabilityGrantManager.import(originalGrants);
    } catch (recoveryError) {
      throw new AggregateError(
        [error, recoveryError],
        "Service package 授权清理失败，且恢复未完整完成。",
      );
    }
    throw error;
  };
}
