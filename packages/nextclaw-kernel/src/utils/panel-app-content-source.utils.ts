import { readFile } from "node:fs/promises";
import {
  encodePanelAppId,
  injectPanelAppAssetBase,
  type PanelAppSource,
} from "@kernel/utils/panel-app-source.utils.js";
import { parsePanelAppManifest } from "@kernel/utils/panel-app-manifest.utils.js";
import type { PanelAppManifest } from "@kernel/utils/panel-app-manifest.utils.js";
import type { PanelAppSourceService } from "@kernel/services/panel-app-source.service.js";
import {
  isPanelAppError,
  PanelAppError,
} from "@kernel/types/panel-app.types.js";

export type ResolvedPanelAppContentSource = {
  appId: string;
  sourceId: string;
  source: PanelAppSource;
  manifest: PanelAppManifest;
  html: string;
  htmlWithBase: string;
};

export async function readPanelAppContentSource(params: {
  createAssetBaseHref: (source: PanelAppSource) => string;
  id: string;
  panelsPath: string;
  sourceService: PanelAppSourceService;
}): Promise<ResolvedPanelAppContentSource> {
  const { createAssetBaseHref, id, panelsPath, sourceService } = params;
  const source = await sourceService.resolveSource(panelsPath, id);
  const html = await readFile(source.entryPath, "utf8");
  const manifest = source.manifest ?? parsePanelAppManifest(html);
  const sourceId = encodePanelAppId(source.sourceName);
  return {
    appId: resolvePanelAppAppId(source, manifest),
    sourceId,
    source,
    manifest,
    html,
    htmlWithBase: source.kind === "folder"
      ? injectPanelAppAssetBase(html, createAssetBaseHref(source))
      : html,
  };
}

export async function readPanelAppContentSourceByIdOrAppId(params: {
  appIdOrSourceId: string;
  createAssetBaseHref: (source: PanelAppSource) => string;
  panelsPath: string;
  sourceService: PanelAppSourceService;
}): Promise<ResolvedPanelAppContentSource> {
  const { appIdOrSourceId, createAssetBaseHref, panelsPath, sourceService } = params;
  try {
    return await readPanelAppContentSource({
      createAssetBaseHref,
      id: appIdOrSourceId,
      panelsPath,
      sourceService,
    });
  } catch (error) {
    if (!isPanelAppError(error)) {
      throw error;
    }
    if (error.code !== "PANEL_APP_INVALID_ID" && error.code !== "PANEL_APP_NOT_FOUND") {
      throw error;
    }
  }
  const sources = await sourceService.listSources(panelsPath);
  for (const source of sources) {
    const html = await readFile(source.entryPath, "utf8");
    const manifest = source.manifest ?? parsePanelAppManifest(html);
    if (resolvePanelAppAppId(source, manifest) === appIdOrSourceId) {
      return await readPanelAppContentSource({
        createAssetBaseHref,
        id: encodePanelAppId(source.sourceName),
        panelsPath,
        sourceService,
      });
    }
  }
  throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
}

export function resolvePanelAppAppId(
  source: PanelAppSource,
  manifest: PanelAppManifest,
): string {
  return manifest.id ?? encodePanelAppId(source.sourceName);
}

export async function assertPanelAppDeclaresClient(params: {
  appId: string;
  panelsPath: string;
  sourceService: PanelAppSourceService;
}): Promise<void> {
  const { appId, panelsPath, sourceService } = params;
  const sources = await sourceService.listSources(panelsPath);
  for (const source of sources) {
    const manifest = source.manifest ?? parsePanelAppManifest(await readFile(source.entryPath, "utf8"));
    if (resolvePanelAppAppId(source, manifest) !== appId) {
      continue;
    }
    if (!manifest.client) {
      throw new PanelAppError(
        "PANEL_APP_CLIENT_NOT_DECLARED",
        "panel app did not declare client access",
      );
    }
    return;
  }
  throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
}
