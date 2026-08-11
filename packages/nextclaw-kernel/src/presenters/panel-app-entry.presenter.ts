import { readFile } from "node:fs/promises";
import type { PanelAppEntry } from "@kernel/managers/panel-app.manager.js";
import type { PanelAppStateEntry } from "@kernel/stores/panel-app-state.store.js";
import type { AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import { resolvePanelAppAppId } from "@kernel/utils/panel-app-content-source.utils.js";
import { parsePanelAppManifest } from "@kernel/utils/panel-app-manifest.utils.js";
import {
  encodePanelAppId,
  resolvePanelAppIconUrl,
  toPanelAppTitle,
  type PanelAppSource,
} from "@kernel/utils/panel-app-source.utils.js";
import {
  resolvePanelAppActivityMs,
  resolvePanelAppCreatedAt,
} from "@kernel/utils/panel-app-time.utils.js";

export class PanelAppEntryPresenter {
  constructor(private readonly params: {
    contentBasePath: string;
    createAssetBaseHref: (source: PanelAppSource) => string;
    isClientGranted: (appId: string, clientDeclared: boolean) => Promise<boolean>;
  }) {}

  build = async (
    source: PanelAppSource,
    state: PanelAppStateEntry,
    packageSource?: AppPackageComponentSource,
  ): Promise<PanelAppEntry> => {
    const manifest = source.manifest ?? parsePanelAppManifest(
      await readFile(source.entryPath, "utf8"),
    );
    const id = encodePanelAppId(source.sourceName);
    const appId = resolvePanelAppAppId(source, manifest);
    const entry: PanelAppEntry = {
      id,
      appId,
      fileName: source.sourceName,
      kind: source.kind,
      title: manifest.title ?? toPanelAppTitle(source.sourceName),
      contentPath: packageSource
        ? `${this.params.contentBasePath}/${encodeURIComponent(id)}/content?${new URLSearchParams({ path: source.sourcePath })}`
        : `${this.params.contentBasePath}/${encodeURIComponent(id)}/content`,
      createdAt: resolvePanelAppCreatedAt(source.sourceStat),
      updatedAt: source.sourceStat.mtime.toISOString(),
      sizeBytes: source.sourceStat.size,
      favorite: state.favorite ?? false,
      clientDeclared: manifest.client,
      clientGranted: await this.params.isClientGranted(appId, manifest.client),
      openCount: state.openCount ?? 0,
      sourceKind: packageSource ? "package" : "workspace",
      packageId: packageSource?.packageId,
      packageVersion: packageSource?.packageVersion,
    };
    if (manifest.description) {
      entry.description = manifest.description;
    }
    if (manifest.icon) {
      entry.icon = source.kind === "folder"
        ? packageSource
          ? `${this.params.createAssetBaseHref(source)}${manifest.icon.replace(/^\/+/, "")}`
          : resolvePanelAppIconUrl(id, manifest.icon)
        : manifest.icon;
    }
    if (state.lastOpenedAt) {
      entry.lastOpenedAt = state.lastOpenedAt;
    }
    return entry;
  };

  compare = (left: PanelAppEntry, right: PanelAppEntry): number =>
    resolvePanelAppActivityMs(right) - resolvePanelAppActivityMs(left) ||
    Number(right.favorite) - Number(left.favorite) ||
    left.title.localeCompare(right.title);
}
