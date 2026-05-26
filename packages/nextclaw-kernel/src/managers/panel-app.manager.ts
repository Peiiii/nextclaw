import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_PANELS_DIR,
  getWorkspacePathFromConfig,
} from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";

const PANEL_APP_FILE_SUFFIX = ".panel.html";
const PANEL_APP_CONTENT_BASE_PATH = "/api/panel-apps";
const PANEL_APP_CONTENT_TYPE = "text/html; charset=utf-8" as const;

export type PanelAppEntry = {
  id: string;
  fileName: string;
  title: string;
  contentPath: string;
  updatedAt: string;
  sizeBytes: number;
};

export type PanelAppList = {
  workspacePath: string;
  panelsPath: string;
  entries: PanelAppEntry[];
};

export type PanelAppContent = {
  id: string;
  fileName: string;
  html: string;
  contentType: typeof PANEL_APP_CONTENT_TYPE;
};

export type PanelAppErrorCode =
  | "PANEL_APP_INVALID_ID"
  | "PANEL_APP_NOT_FOUND"
  | "PANEL_APP_READ_FAILED";

export class PanelAppError extends Error {
  constructor(
    readonly code: PanelAppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PanelAppError";
  }
}

export function isPanelAppError(error: unknown): error is PanelAppError {
  return error instanceof PanelAppError;
}

export class PanelAppManager {
  constructor(private readonly params: { configManager: ConfigManager }) {}

  listPanelApps = async (): Promise<PanelAppList> => {
    const workspacePath = this.getWorkspacePath();
    const panelsPath = this.getPanelsPath(workspacePath);
    const fileNames = await this.listPanelAppFileNames(panelsPath);
    const entries = await Promise.all(
      fileNames.map((fileName) => this.buildPanelAppEntry(panelsPath, fileName)),
    );

    return {
      workspacePath,
      panelsPath,
      entries: entries.sort((left, right) =>
        left.title.localeCompare(right.title),
      ),
    };
  };

  getPanelAppContent = async (id: string): Promise<PanelAppContent> => {
    const fileName = this.decodePanelAppId(id);
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const filePath = join(panelsPath, fileName);

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      }
      const html = await readFile(filePath, "utf8");
      return {
        id: this.encodePanelAppId(fileName),
        fileName,
        html,
        contentType: PANEL_APP_CONTENT_TYPE,
      };
    } catch (error) {
      if (isPanelAppError(error)) {
        throw error;
      }
      if (this.isMissingFileError(error)) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  private getWorkspacePath = (): string =>
    getWorkspacePathFromConfig(this.params.configManager.config);

  private getPanelsPath = (workspacePath: string): string =>
    join(workspacePath, DEFAULT_PANELS_DIR);

  private listPanelAppFileNames = async (panelsPath: string): Promise<string[]> => {
    try {
      const entries = await readdir(panelsPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && this.isPanelAppFileName(entry.name))
        .map((entry) => entry.name);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  private buildPanelAppEntry = async (
    panelsPath: string,
    fileName: string,
  ): Promise<PanelAppEntry> => {
    const fileStat = await stat(join(panelsPath, fileName));
    const id = this.encodePanelAppId(fileName);
    return {
      id,
      fileName,
      title: this.toPanelAppTitle(fileName),
      contentPath: `${PANEL_APP_CONTENT_BASE_PATH}/${encodeURIComponent(id)}/content`,
      updatedAt: fileStat.mtime.toISOString(),
      sizeBytes: fileStat.size,
    };
  };

  private encodePanelAppId = (fileName: string): string =>
    Buffer.from(fileName, "utf8").toString("base64url");

  private decodePanelAppId = (id: string): string => {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new PanelAppError("PANEL_APP_INVALID_ID", "panel app id is required");
    }
    let fileName = "";
    try {
      fileName = Buffer.from(normalizedId, "base64url").toString("utf8");
    } catch {
      throw new PanelAppError("PANEL_APP_INVALID_ID", "invalid panel app id");
    }
    if (
      this.encodePanelAppId(fileName) !== normalizedId ||
      !this.isPanelAppFileName(fileName)
    ) {
      throw new PanelAppError("PANEL_APP_INVALID_ID", "invalid panel app id");
    }
    return fileName;
  };

  private isPanelAppFileName = (fileName: string): boolean =>
    fileName.endsWith(PANEL_APP_FILE_SUFFIX) &&
    !fileName.includes("/") &&
    !fileName.includes("\\") &&
    !fileName.includes("\0");

  private toPanelAppTitle = (fileName: string): string =>
    fileName
      .slice(0, -PANEL_APP_FILE_SUFFIX.length)
      .replace(/[-_]+/g, " ")
      .trim() || fileName;

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
