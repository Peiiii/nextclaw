import type {
  AppDocumentGrantMutationResult,
  AppGrantService,
  AppInstallationService,
  AppRegistryService,
} from "@nextclaw/app-runtime";
import {
  AppPackageError,
  type AppPackageComponentSource,
  type AppPackageRuntimeHooks,
  type AppPackageView,
} from "@kernel/types/app-package.types.js";

type DocumentAccessMode = "read" | "read-write";

export class AppPackageDocumentAccessService {
  constructor(
    private readonly params: {
      grantService: AppGrantService;
      installationService: AppInstallationService;
      registryService: AppRegistryService;
      getPackage: (appId: string) => Promise<AppPackageView>;
      getRuntimeHooks: () => AppPackageRuntimeHooks;
    },
  ) {}

  inspect = async (appId: string) =>
    await this.params.installationService.withAppOperation(appId, async () => {
      try {
        return await this.params.grantService.summarize(appId);
      } catch (error) {
        throw this.toError(error);
      }
    });

  assert = async (
    appId: string,
    scopeId: string,
    requestedMode: DocumentAccessMode,
  ): Promise<void> => {
    const state = await this.inspect(appId);
    const scope = state.documentAccess.find((entry) => entry.id === scopeId);
    if (!scope) {
      throw new AppPackageError(
        "DOCUMENT_SCOPE_NOT_DECLARED",
        `App ${appId} does not declare document scope ${scopeId}.`,
      );
    }
    if (!scope.granted) {
      throw new AppPackageError(
        "DOCUMENT_SCOPE_NOT_GRANTED",
        `App ${appId} requires document scope ${scopeId}. Grant it and retry the action.`,
      );
    }
    if (scope.status === "unavailable") {
      throw new AppPackageError(
        "DOCUMENT_SCOPE_UNAVAILABLE",
        `App ${appId} document scope ${scopeId} is unavailable. Replace or revoke it.`,
      );
    }
    if (
      requestedMode === "read-write" &&
      scope.effectiveMode !== "read-write"
    ) {
      throw new AppPackageError(
        "DOCUMENT_SCOPE_MODE_INSUFFICIENT",
        `App ${appId} document scope ${scopeId} needs read-write access.`,
      );
    }
  };

  grant = async (
    appId: string,
    input: {
      scopeId: string;
      directoryPath: string;
      mode: DocumentAccessMode;
    },
  ): Promise<AppDocumentGrantMutationResult> =>
    await this.mutate(
      appId,
      input.scopeId,
      async () =>
        await this.params.grantService.grantDocumentScope({ appId, ...input }),
    );

  revoke = async (
    appId: string,
    scopeId: string,
  ): Promise<AppDocumentGrantMutationResult> =>
    await this.mutate(appId, scopeId, async () => {
      const state = await this.params.grantService.summarize(appId);
      if (!state.documentAccess.some((scope) => scope.id === scopeId)) {
        throw new AppPackageError(
          "DOCUMENT_SCOPE_NOT_DECLARED",
          `App ${appId} does not declare document scope ${scopeId}.`,
        );
      }
      return await this.params.grantService.revokeDocumentScope({
        appId,
        scopeId,
      });
    });

  private mutate = async <T>(
    appId: string,
    scopeId: string,
    mutation: () => Promise<T>,
  ): Promise<T> =>
    await this.params.installationService.withAppOperation(appId, async () => {
      const app = await this.params.getPackage(appId);
      const previousRecord = await this.params.registryService.getApp(appId);
      const previousGrant = previousRecord?.grants[scopeId];
      const sources = this.toComponentSources(app);
      const runtimeHooks = this.params.getRuntimeHooks();
      const rollbackRuntime = app.enabled
        ? await runtimeHooks.prepareCapabilityChange(sources)
        : async () => undefined;
      try {
        const result = await mutation();
        if (app.enabled) await runtimeHooks.afterCapabilityChange(sources);
        return result;
      } catch (error) {
        const recoveryErrors: unknown[] = [];
        try {
          await this.params.registryService.restoreDocumentGrant(
            appId,
            scopeId,
            previousGrant,
          );
        } catch (recoveryError) {
          recoveryErrors.push(recoveryError);
        }
        try {
          await rollbackRuntime();
        } catch (recoveryError) {
          recoveryErrors.push(recoveryError);
        }
        if (recoveryErrors.length > 0) {
          throw new AggregateError(
            [error, ...recoveryErrors],
            `App ${appId} document scope ${scopeId} mutation failed and recovery was incomplete.`,
          );
        }
        throw this.toError(error);
      }
    });

  private toComponentSources = (
    app: AppPackageView,
  ): AppPackageComponentSource[] =>
    app.components.map((component) => ({ ...component }));

  private toError = (error: unknown): AppPackageError => {
    if (error instanceof AppPackageError) return error;
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("未声明 documentAccess scope")) {
      return new AppPackageError("DOCUMENT_SCOPE_NOT_DECLARED", message);
    }
    if (message.includes("只声明了 read")) {
      return new AppPackageError("DOCUMENT_SCOPE_MODE_INSUFFICIENT", message);
    }
    if (message.includes("不是可用目录")) {
      return new AppPackageError("DOCUMENT_SCOPE_UNAVAILABLE", message);
    }
    return new AppPackageError("DOCUMENT_SCOPE_MUTATION_FAILED", message);
  };
}
