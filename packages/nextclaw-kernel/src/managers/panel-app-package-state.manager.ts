import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { PanelAppSourceService } from "@kernel/services/panel-app-source.service.js";
import type { CapabilityGrant, CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import type { PanelAppStateStore } from "@kernel/stores/panel-app-state.store.js";
import {
  AppPackageError,
  type AppPackageComponentSource,
} from "@kernel/types/app-package.types.js";
import {
  isPanelAppError,
  PanelAppError,
} from "@kernel/types/panel-app.types.js";
import {
  readPanelAppContentSourceByIdOrPath,
  resolvePanelAppAppId,
} from "@kernel/utils/panel-app-content-source.utils.js";
import { parsePanelAppManifest } from "@kernel/utils/panel-app-manifest.utils.js";
import {
  encodePanelAppId,
  type PanelAppSource,
} from "@kernel/utils/panel-app-source.utils.js";

export type ResolvedPanelAppSource = {
  source: PanelAppSource;
  packageSource?: AppPackageComponentSource;
};

export type ResolvedPanelAppTarget = ResolvedPanelAppSource & {
  manifest: ReturnType<typeof parsePanelAppManifest>;
};

export class PanelAppPackageStateManager {
  constructor(private readonly params: {
    sourceService: PanelAppSourceService;
    getPanelsPath: () => string;
    listPackageComponentSources?: () => Promise<AppPackageComponentSource[]>;
    createAssetBaseHref: (source: PanelAppSource) => string;
    suspendBridgeSessions: (appId: string) => () => void;
    createStateStore: (panelsPath: string) => PanelAppStateStore;
    capabilityGrantManager: CapabilityGrantManager;
  }) {}

  listSources = async (): Promise<ResolvedPanelAppSource[]> => {
    const panelsPath = this.params.getPanelsPath();
    const workspaceSources = await this.params.sourceService.listSources(panelsPath);
    const packageSources = (await this.listPackageComponentSources())
      .filter((component) => component.kind === "panel");
    const resolvedPackageSources = await Promise.all(packageSources.map(async (packageSource) => ({
      source: await this.params.sourceService.resolveSourcePath(packageSource.sourcePath),
      packageSource,
    })));
    return [
      ...workspaceSources.map((source) => ({ source })),
      ...resolvedPackageSources,
    ];
  };

  resolveSource = async (id: string): Promise<PanelAppSource> => {
    try {
      return await this.params.sourceService.resolveSource(this.params.getPanelsPath(), id);
    } catch (error) {
      if (
        !isPanelAppError(error) ||
        (error.code !== "PANEL_APP_NOT_FOUND" && error.code !== "PANEL_APP_INVALID_ID")
      ) {
        throw error;
      }
    }
    const match = (await this.listSources()).find(({ source, packageSource }) =>
      packageSource && (
        encodePanelAppId(source.sourceName) === id ||
        packageSource.id === id
      ),
    );
    if (!match) {
      throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
    }
    return match.source;
  };

  findPackageSourceBySourceName = async (
    sourceName: string,
  ): Promise<AppPackageComponentSource | undefined> => {
    return (await this.listPackageComponentSources()).find((component) =>
      component.kind === "panel" && component.sourcePath.endsWith(`/${sourceName}`),
    );
  };

  readContentSourceByIdOrAppId = async (id: string) => {
    const panelsPath = this.params.getPanelsPath();
    const { source } = await this.resolveSourceByIdOrAppId(id);
    return await readPanelAppContentSourceByIdOrPath({
      createAssetBaseHref: this.params.createAssetBaseHref,
      id,
      panelsPath,
      sourcePath: source.sourcePath,
      sourceService: this.params.sourceService,
    });
  };

  resolveSourceByIdOrAppId = async (id: string): Promise<ResolvedPanelAppTarget> => {
    const panelsPath = this.params.getPanelsPath();
    try {
      return await this.toResolvedTarget(
        await this.params.sourceService.resolveSource(panelsPath, id),
      );
    } catch (error) {
      if (
        !isPanelAppError(error) ||
        (error.code !== "PANEL_APP_NOT_FOUND" && error.code !== "PANEL_APP_INVALID_ID")
      ) {
        throw error;
      }
    }

    const packageSources = (await this.listPackageComponentSources())
      .filter((component) => component.kind === "panel");
    const exactPackageSource = packageSources.find((component) => component.id === id);
    if (exactPackageSource) {
      return await this.toResolvedTarget(
        await this.params.sourceService.resolveSourcePath(exactPackageSource.sourcePath),
        exactPackageSource,
      );
    }

    const workspaceSources = await this.params.sourceService.listSources(panelsPath);
    for (const source of workspaceSources) {
      const target = await this.toResolvedTarget(source);
      if (resolvePanelAppAppId(source, target.manifest) === id) return target;
    }
    for (const packageSource of packageSources) {
      const source = await this.params.sourceService.resolveSourcePath(packageSource.sourcePath);
      const target = await this.toResolvedTarget(source, packageSource);
      if (
        encodePanelAppId(source.sourceName) === id ||
        resolvePanelAppAppId(source, target.manifest) === id
      ) return target;
    }
    throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
  };

  assertDeclaresClient = async (appId: string): Promise<void> => {
    const sources = await this.listSources();
    for (const { source } of sources) {
      const manifest = source.manifest ?? parsePanelAppManifest(
        await readFile(source.entryPath, "utf8"),
      );
      if (resolvePanelAppAppId(source, manifest) === appId) {
        if (!manifest.client) {
          throw new PanelAppError(
            "PANEL_APP_CLIENT_NOT_DECLARED",
            "panel app did not declare client access",
          );
        }
        return;
      }
    }
    throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
  };

  assertCanActivate = async (components: AppPackageComponentSource[]): Promise<void> => {
    const panelComponents = components.filter((component) => component.kind === "panel");
    if (panelComponents.length === 0) {
      return;
    }
    const workspaceSources = await this.params.sourceService.listSources(
      this.params.getPanelsPath(),
    );
    const workspaceIds = new Set<string>();
    for (const source of workspaceSources) {
      const manifest = source.manifest ?? parsePanelAppManifest(
        await readFile(source.entryPath, "utf8"),
      );
      workspaceIds.add(resolvePanelAppAppId(source, manifest));
    }
    const activePackageSources = await this.listPackageComponentSources();
    for (const component of panelComponents) {
      const conflictsWithPackage = activePackageSources.some((active) =>
        active.kind === "panel" &&
        active.id === component.id &&
        active.packageId !== component.packageId,
      );
      if (workspaceIds.has(component.id) || conflictsWithPackage) {
        throw new AppPackageError(
          "APP_PACKAGE_CONFLICT",
          `Panel component id 冲突：${component.id}`,
        );
      }
    }
  };

  deactivate = (components: AppPackageComponentSource[]): void => {
    for (const component of components) {
      if (component.kind === "panel") {
        this.params.suspendBridgeSessions(component.id);
      }
    }
  };

  removeState = async (
    components: AppPackageComponentSource[],
  ): Promise<() => Promise<void>> => {
    const panelsPath = this.params.getPanelsPath();
    const panelComponents = components.filter((component) => component.kind === "panel");
    const stateStore = this.params.createStateStore(panelsPath);
    const originalState = await stateStore.load();
    const originalGrants: CapabilityGrant[] = [];
    for (const component of panelComponents) {
      originalGrants.push(...await this.params.capabilityGrantManager.list({
        subject: { type: "panel-app", id: component.id },
      }));
    }
    try {
      for (const component of panelComponents) {
        await stateStore.deleteEntry(
          encodePanelAppId(basename(component.sourcePath)),
          component.id,
        );
        await this.params.capabilityGrantManager.revoke({
          subject: { type: "panel-app", id: component.id },
        });
      }
    } catch (error) {
      const recoveryErrors = await this.restoreState({
        originalGrants,
        originalState,
        stateStore,
      });
      if (recoveryErrors.length > 0) {
        throw new AggregateError(
          [error, ...recoveryErrors],
          "Panel package 卸载准备失败，且状态恢复未完整完成。",
        );
      }
      throw error;
    }
    return async () => {
      const recoveryErrors = await this.restoreState({
        originalGrants,
        originalState,
        stateStore,
      });
      if (recoveryErrors.length > 0) {
        throw new AggregateError(
          recoveryErrors,
          "Panel package 卸载状态恢复未完整完成。",
        );
      }
    };
  };

  private restoreState = async (params: {
    originalGrants: CapabilityGrant[];
    originalState: Awaited<ReturnType<PanelAppStateStore["load"]>>;
    stateStore: PanelAppStateStore;
  }): Promise<unknown[]> => {
    const errors: unknown[] = [];
    for (const operation of [
      async () => await params.stateStore.replace(params.originalState),
      async () => await this.params.capabilityGrantManager.import(params.originalGrants),
    ]) {
      try {
        await operation();
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  };

  private listPackageComponentSources = async (): Promise<AppPackageComponentSource[]> =>
    await this.params.listPackageComponentSources?.() ?? [];

  private toResolvedTarget = async (
    source: PanelAppSource,
    packageSource?: AppPackageComponentSource,
  ): Promise<ResolvedPanelAppTarget> => ({
    source,
    packageSource,
    manifest: source.manifest ?? parsePanelAppManifest(
      await readFile(source.entryPath, "utf8"),
    ),
  });
}
