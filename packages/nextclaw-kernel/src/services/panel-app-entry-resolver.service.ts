import type {
  ResolvedPanelAppSource,
  ResolvedPanelAppTarget,
} from "@kernel/managers/panel-app-package-state.manager.js";
import type { PanelAppEntryPresenter } from "@kernel/presenters/panel-app-entry.presenter.js";
import type { PanelAppStateSnapshot } from "@kernel/stores/panel-app-state.store.js";
import type { AppPackageUnavailableDiagnostic } from "@kernel/types/app-package.types.js";
import {
  isPanelAppError,
  PanelAppError,
  type PanelAppEntry,
  type PanelAppList,
} from "@kernel/types/panel-app.types.js";
import { encodePanelAppId } from "@kernel/utils/panel-app-source.utils.js";

export class PanelAppEntryResolverService {
  constructor(private readonly params: {
    getWorkspacePath: () => string;
    getPanelsPath: (workspacePath: string) => string;
    listSources: () => Promise<ResolvedPanelAppSource[]>;
    listPackageComponentDiagnostics?: () => Promise<AppPackageUnavailableDiagnostic[]>;
    resolveSourceByIdOrAppId: (id: string) => Promise<ResolvedPanelAppTarget>;
    loadState: () => Promise<PanelAppStateSnapshot>;
    buildEntry: PanelAppEntryPresenter["build"];
    compareEntries: PanelAppEntryPresenter["compare"];
    resolvePackagePrimaryPanelId?: (appId: string) => Promise<string | undefined>;
  }) {}

  list = async (): Promise<PanelAppList> => {
    const workspacePath = this.params.getWorkspacePath();
    const panelsPath = this.params.getPanelsPath(workspacePath);
    const sources = await this.params.listSources();
    const appState = await this.params.loadState();
    const entries = await Promise.all(sources.map(({ source, packageSource }) =>
      this.params.buildEntry(
        source,
        appState.apps[encodePanelAppId(source.sourceName)] ?? {},
        packageSource,
        appState.mainSidebarAppIds,
      )));
    return {
      workspacePath,
      panelsPath,
      entries: entries.sort(this.params.compareEntries),
      unavailablePackages: await this.params.listPackageComponentDiagnostics?.() ?? [],
    };
  };

  get = async (id: string): Promise<PanelAppEntry> => {
    const resolved = await this.params.resolveSourceByIdOrAppId(id);
    const appState = await this.params.loadState();
    return await this.params.buildEntry(
      resolved.source,
      appState.apps[encodePanelAppId(resolved.source.sourceName)] ?? {},
      resolved.packageSource,
      appState.mainSidebarAppIds,
    );
  };

  resolveDisplayTarget = async (id: string): Promise<PanelAppEntry> => {
    try {
      return await this.get(id);
    } catch (error) {
      this.rethrowUnexpectedResolutionError(error);
    }

    const primaryPanelId = await this.params.resolvePackagePrimaryPanelId?.(id);
    if (primaryPanelId) {
      try {
        return await this.get(primaryPanelId);
      } catch (error) {
        this.rethrowUnexpectedResolutionError(error);
      }
    }

    throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
  };

  private rethrowUnexpectedResolutionError = (error: unknown): void => {
    if (!isPanelAppError(error) || (
      error.code !== "PANEL_APP_NOT_FOUND" &&
      error.code !== "PANEL_APP_INVALID_ID"
    )) {
      throw error;
    }
  };
}
