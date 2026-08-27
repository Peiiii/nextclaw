import type { AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import type { ServiceAppRuntimeStatus } from "@kernel/types/service-app.types.js";

type ServiceAppRuntimeSnapshot = {
  status: ServiceAppRuntimeStatus;
  lastError?: string;
};

export class ServiceAppPackageRuntimeService {
  constructor(private readonly params: {
    getStatus: (serviceId: string) => ServiceAppRuntimeSnapshot;
    restore: (serviceId: string) => Promise<void>;
    stop: (serviceId: string) => Promise<void>;
  }) {}

  prepareDeactivation = async (
    components: AppPackageComponentSource[],
  ): Promise<() => Promise<void>> => {
    const serviceIds = components
      .filter((component) => component.kind === "service")
      .map((component) => component.id);
    const runningServiceIds = serviceIds.filter((serviceId) =>
      this.params.getStatus(serviceId).status === "running"
    );
    const stoppedServiceIds: string[] = [];
    try {
      for (const serviceId of serviceIds) {
        await this.params.stop(serviceId);
        stoppedServiceIds.push(serviceId);
      }
    } catch (error) {
      await this.throwAfterRestore(
        stoppedServiceIds.filter((serviceId) => runningServiceIds.includes(serviceId)),
        error,
        "Service package runtime 停止失败，且恢复未完整完成。",
      );
    }
    return async () => {
      const recoveryErrors = await this.restoreAll(runningServiceIds);
      if (recoveryErrors.length > 0) {
        throw new AggregateError(
          recoveryErrors,
          "Service package runtime 恢复未完整完成。",
        );
      }
    };
  };

  private throwAfterRestore = async (
    serviceIds: string[],
    error: unknown,
    message: string,
  ): Promise<never> => {
    const recoveryErrors = await this.restoreAll(serviceIds);
    if (recoveryErrors.length > 0) {
      throw new AggregateError([error, ...recoveryErrors], message);
    }
    throw error;
  };

  private restoreAll = async (serviceIds: string[]): Promise<unknown[]> => {
    const errors: unknown[] = [];
    for (const serviceId of serviceIds) {
      try {
        await this.params.restore(serviceId);
        const status = this.params.getStatus(serviceId);
        if (status.status !== "running") {
          throw new Error(
            `Service component ${serviceId} runtime 恢复失败：${status.lastError ?? status.status}`,
          );
        }
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  };
}
