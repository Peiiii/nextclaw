import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { PanelAppSourceService } from "@kernel/services/panel-app-source.service.js";
import type { PanelAppCapabilityGrantStore } from "@kernel/stores/panel-app-capability-grant.store.js";
import type { PanelAppClientGrantStore } from "@kernel/stores/panel-app-client-grant.store.js";
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

export class PanelAppPackageStateManager {
  constructor(private readonly params: {
    sourceService: PanelAppSourceService;
    getPanelsPath: () => string;
    listPackageComponentSources?: () => Promise<AppPackageComponentSource[]>;
    createAssetBaseHref: (source: PanelAppSource) => string;
    deleteBridgeSessions: (appId: string) => void;
    createStateStore: (panelsPath: string) => PanelAppStateStore;
    createCapabilityGrantStore: () => PanelAppCapabilityGrantStore;
    createClientGrantStore: () => PanelAppClientGrantStore;
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
      if (!isPanelAppError(error) || error.code !== "PANEL_APP_NOT_FOUND") {
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
    for (const { source, packageSource } of await this.listSources()) {
      const manifest = source.manifest ?? parsePanelAppManifest(
        await readFile(source.entryPath, "utf8"),
      );
      if (
        encodePanelAppId(source.sourceName) !== id &&
        resolvePanelAppAppId(source, manifest) !== id &&
        packageSource?.id !== id
      ) {
        continue;
      }
      return await readPanelAppContentSourceByIdOrPath({
        createAssetBaseHref: this.params.createAssetBaseHref,
        id,
        panelsPath,
        sourcePath: source.sourcePath,
        sourceService: this.params.sourceService,
      });
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
        this.params.deleteBridgeSessions(component.id);
      }
    }
  };

  removeState = async (components: AppPackageComponentSource[]): Promise<void> => {
    const panelsPath = this.params.getPanelsPath();
    for (const component of components) {
      if (component.kind !== "panel") {
        continue;
      }
      this.params.deleteBridgeSessions(component.id);
      await this.params.createStateStore(panelsPath).deleteEntry(
        encodePanelAppId(basename(component.sourcePath)),
        component.id,
      );
      await this.params.createCapabilityGrantStore().deleteCaller({
        surface: "panel-app",
        appId: component.id,
      });
      await this.params.createClientGrantStore().revoke(component.id);
    }
  };

  private listPackageComponentSources = async (): Promise<AppPackageComponentSource[]> =>
    await this.params.listPackageComponentSources?.() ?? [];
}
