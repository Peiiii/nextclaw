import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getDataDir } from "@nextclaw/core";
import type { NpmRuntimeBundlePointer } from "@nextclaw-service/types/npm-runtime-bundle.types.js";

export class NpmRuntimeBundleLayoutStore {
  constructor(private readonly rootDirectory = join(getDataDir(), "launcher", "runtime-bundles")) {}

  getRootDir = (): string => this.rootDirectory;

  getVersionsDir = (): string => join(this.rootDirectory, "versions");

  getVersionDir = (version: string): string => join(this.getVersionsDir(), version);

  getStagingDir = (): string => join(this.rootDirectory, "staging");

  getCurrentPointerPath = (): string => join(this.rootDirectory, "current.json");

  getPreviousPointerPath = (): string => join(this.rootDirectory, "previous.json");

  getStatePath = (): string => join(getDataDir(), "launcher", "npm-runtime-update-state.json");

  ensureLauncherDirs = (): void => {
    mkdirSync(this.getVersionsDir(), { recursive: true });
    mkdirSync(this.getStagingDir(), { recursive: true });
    mkdirSync(dirname(this.getStatePath()), { recursive: true });
  };

  readCurrentPointer = (): NpmRuntimeBundlePointer | null => this.readPointer(this.getCurrentPointerPath());

  readPreviousPointer = (): NpmRuntimeBundlePointer | null => this.readPointer(this.getPreviousPointerPath());

  writeCurrentPointer = (pointer: NpmRuntimeBundlePointer): void => this.writePointer(this.getCurrentPointerPath(), pointer);

  writePreviousPointer = (pointer: NpmRuntimeBundlePointer): void => this.writePointer(this.getPreviousPointerPath(), pointer);

  private readPointer = (pointerPath: string): NpmRuntimeBundlePointer | null => {
    if (!existsSync(pointerPath)) {
      return null;
    }
    const parsed = JSON.parse(readFileSync(pointerPath, "utf8")) as Record<string, unknown>;
    const version = typeof parsed.version === "string" ? parsed.version.trim() : "";
    return version ? { version } : null;
  };

  private writePointer = (pointerPath: string, pointer: NpmRuntimeBundlePointer): void => {
    mkdirSync(dirname(pointerPath), { recursive: true });
    writeFileSync(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  };
}
