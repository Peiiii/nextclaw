import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveDesktopDataDir } from "../../utils/desktop-paths.utils";

export type DesktopVersionPointer = {
  version: string;
};

function readJsonObject(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeVersionPointer(parsed: Record<string, unknown> | null): DesktopVersionPointer | null {
  const version = typeof parsed?.version === "string" ? parsed.version.trim() : "";
  if (!version) {
    return null;
  }
  return { version };
}

export class DesktopBundleLayoutStore {
  constructor(private readonly baseDir = resolveDesktopDataDir()) {}

  getBaseDir = (): string => this.baseDir;

  getLauncherDir = (): string => join(this.baseDir, "launcher");

  getVersionsDir = (): string => join(this.baseDir, "versions");

  getStagingDir = (): string => join(this.baseDir, "staging");

  getLauncherStatePath = (): string => join(this.getLauncherDir(), "state.json");

  getCurrentPointerPath = (): string => join(this.baseDir, "current.json");

  getPreviousPointerPath = (): string => join(this.baseDir, "previous.json");

  getVersionDir = (version: string): string => join(this.getVersionsDir(), version);

  getVersionManifestPath = (version: string): string => join(this.getVersionDir(version), "manifest.json");

  getVersionUiDir = (version: string): string => join(this.getVersionDir(version), "ui");

  getVersionRuntimeDir = (version: string): string => join(this.getVersionDir(version), "runtime");

  getVersionPluginsDir = (version: string): string => join(this.getVersionDir(version), "plugins");

  ensureLauncherDirs = async (): Promise<void> => {
    await Promise.all([
      mkdir(this.getLauncherDir(), { recursive: true }),
      mkdir(this.getVersionsDir(), { recursive: true }),
      mkdir(this.getStagingDir(), { recursive: true })
    ]);
  };

  readCurrentPointer = (): DesktopVersionPointer | null => normalizeVersionPointer(readJsonObject(this.getCurrentPointerPath()));

  readPreviousPointer = (): DesktopVersionPointer | null => normalizeVersionPointer(readJsonObject(this.getPreviousPointerPath()));

  writeCurrentPointer = async (pointer: DesktopVersionPointer): Promise<void> => {
    await this.writePointer(this.getCurrentPointerPath(), pointer);
  };

  writePreviousPointer = async (pointer: DesktopVersionPointer): Promise<void> => {
    await this.writePointer(this.getPreviousPointerPath(), pointer);
  };

  clearCurrentPointer = async (): Promise<void> => {
    await rm(this.getCurrentPointerPath(), { force: true });
  };

  clearPreviousPointer = async (): Promise<void> => {
    await rm(this.getPreviousPointerPath(), { force: true });
  };

  private writePointer = async (filePath: string, pointer: DesktopVersionPointer): Promise<void> => {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  };
}
