import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { PanelAppError, isPanelAppError } from "@kernel/types/panel-app.types.js";
import {
  decodePanelAppId,
  isPanelAppDirName,
  isPanelAppFileName,
  isPanelAppSourceEntry,
  readPanelAppFolderManifest,
  resolvePanelAppAssetContentType,
  resolvePanelAppRelativePath,
  type PanelAppAsset,
  type PanelAppSource,
} from "@kernel/utils/panel-app-source.utils.js";

export class PanelAppSourceService {
  listSources = async (panelsPath: string): Promise<PanelAppSource[]> => {
    try {
      const entries = await readdir(panelsPath, { withFileTypes: true });
      const sources: PanelAppSource[] = [];
      for (const entry of entries.filter(isPanelAppSourceEntry)) {
        try {
          sources.push(await this.readSource(panelsPath, entry.name));
        } catch (error) {
          if (!isPanelAppError(error) || error.code !== "PANEL_APP_NOT_FOUND") {
            throw error;
          }
        }
      }
      return sources;
    } catch (error) {
      if (isPanelAppError(error)) {
        throw error;
      }
      if (isMissingFileError(error)) {
        return [];
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  resolveSource = async (
    panelsPath: string,
    id: string,
  ): Promise<PanelAppSource> => {
    const sourceName = decodePanelAppId(id);
    try {
      return await this.readSource(panelsPath, sourceName);
    } catch (error) {
      if (isPanelAppError(error)) {
        throw error;
      }
      if (isMissingFileError(error)) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  resolveSourcePath = async (sourcePath: string): Promise<PanelAppSource> => {
    const normalizedPath = sourcePath.trim();
    if (!normalizedPath || !isAbsolute(normalizedPath)) {
      throw new PanelAppError(
        "PANEL_APP_INVALID_SOURCE_PATH",
        "panel app source path must be absolute",
      );
    }
    const resolvedPath = resolve(normalizedPath);
    try {
      return await this.readSource(dirname(resolvedPath), basename(resolvedPath));
    } catch (error) {
      if (isPanelAppError(error)) {
        throw error;
      }
      if (isMissingFileError(error)) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  getAsset = async (
    panelsPath: string,
    id: string,
    assetPath: string,
  ): Promise<PanelAppAsset> => {
    return await this.readAsset(await this.resolveSource(panelsPath, id), assetPath);
  };

  getAssetBySourcePath = async (
    sourcePath: string,
    assetPath: string,
  ): Promise<PanelAppAsset> => {
    return await this.readAsset(await this.resolveSourcePath(sourcePath), assetPath);
  };

  private readAsset = async (
    source: PanelAppSource,
    assetPath: string,
  ): Promise<PanelAppAsset> => {
    if (source.kind !== "folder") {
      throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app asset not found");
    }
    const filePath = resolvePanelAppRelativePath(source.sourcePath, assetPath);
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app asset not found");
      }
      return {
        content: await readFile(filePath),
        contentType: resolvePanelAppAssetContentType(filePath),
      };
    } catch (error) {
      if (isPanelAppError(error)) {
        throw error;
      }
      if (isMissingFileError(error)) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app asset not found");
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  private readSource = async (
    panelsPath: string,
    sourceName: string,
  ): Promise<PanelAppSource> => {
    const sourcePath = join(panelsPath, sourceName);
    const sourceStat = await stat(sourcePath);
    if (sourceStat.isFile() && isPanelAppFileName(sourceName)) {
      return {
        kind: "single-file",
        sourceName,
        sourcePath,
        entryPath: sourcePath,
        sourceStat,
      };
    }
    if (sourceStat.isDirectory() && isPanelAppDirName(sourceName)) {
      return await this.readFolderSource(sourcePath, sourceName, sourceStat);
    }
    throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
  };

  private readFolderSource = async (
    sourcePath: string,
    sourceName: string,
    sourceStat: PanelAppSource["sourceStat"],
  ): Promise<PanelAppSource> => {
    try {
      const manifest = await readPanelAppFolderManifest(sourcePath, sourceName);
      const entryPath = resolvePanelAppRelativePath(sourcePath, manifest.entry);
      const entryStat = await stat(entryPath);
      if (!entryStat.isFile()) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app entry not found");
      }
      return {
        kind: "folder",
        sourceName,
        sourcePath,
        entryPath,
        manifest,
        sourceStat,
      };
    } catch (error) {
      if (isPanelAppError(error)) {
        throw error;
      }
      if (isMissingFileError(error)) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      }
      throw new PanelAppError(
        "PANEL_APP_MANIFEST_INVALID",
        error instanceof Error ? error.message : String(error),
      );
    }
  };
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
