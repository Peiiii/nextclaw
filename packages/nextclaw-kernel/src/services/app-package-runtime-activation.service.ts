import type {
  AppPackageComponentSource,
  AppPackageRuntimeHooks,
} from "@kernel/types/app-package.types.js";

export const EMPTY_APP_PACKAGE_RUNTIME_HOOKS: AppPackageRuntimeHooks = {
  listCapabilityProviders: async () => [],
  assertCanActivate: async () => undefined,
  afterActivate: async () => undefined,
  beforeDeactivate: async () => undefined,
  prepareCapabilityChange: async () => async () => undefined,
  afterCapabilityChange: async () => undefined,
  beforeUninstall: async () => undefined,
};

export class AppPackageRuntimeActivationService {
  recoverFailedActivation = async (params: {
    appId: string;
    error: unknown;
    sources: AppPackageComponentSource[];
    beforeDeactivate: (sources: AppPackageComponentSource[]) => Promise<void>;
    disable: () => Promise<void>;
  }): Promise<void> => {
    const recoveryErrors: unknown[] = [];
    try {
      await params.beforeDeactivate(params.sources);
    } catch (recoveryError) {
      recoveryErrors.push(recoveryError);
    }
    try {
      await params.disable();
    } catch (recoveryError) {
      recoveryErrors.push(recoveryError);
    }
    if (recoveryErrors.length > 0) {
      throw new AggregateError(
        [params.error, ...recoveryErrors],
        `应用 ${params.appId} 启用失败，且 runtime 状态恢复未完整完成。`,
      );
    }
  };
}
