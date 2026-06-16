import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const VISIBILITY_PATCH_ENV = "NEXTCLAW_CODEX_DESKTOP_VISIBILITY_PATCH";
const CODEX_GLOBAL_STATE_FILE_NAME = ".codex-global-state.json";
const SAVED_WORKSPACE_ROOTS_KEY = "electron-saved-workspace-roots";
const DEEP_LINK_VERIFICATION_TIMEOUT_MS = 2_500;
const DEEP_LINK_VERIFICATION_INTERVAL_MS = 100;
const execFileAsync = promisify(execFile);

export interface CodexDesktopVisibilityPatch {
  ensureWorkspaceVisible(params: { workingDirectory?: string }): Promise<void>;
}

export type OpenCodexDeepLink = (url: string) => Promise<void>;

export interface CodexDesktopVisibilityPatchServiceOptions {
  deepLinkVerificationIntervalMs?: number;
  deepLinkVerificationTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  globalStatePath?: string;
  homeDirectory?: string;
  openCodexDeepLink?: OpenCodexDeepLink;
  platform?: NodeJS.Platform;
}

export class CodexDesktopVisibilityPatchService implements CodexDesktopVisibilityPatch {
  private readonly deepLinkVerificationIntervalMs: number;
  private readonly deepLinkVerificationTimeoutMs: number;
  private readonly env: NodeJS.ProcessEnv;
  private readonly globalStatePath?: string;
  private readonly homeDirectory: string;
  private readonly openCodexDeepLink: OpenCodexDeepLink;
  private readonly platform: NodeJS.Platform;
  private readonly shouldUseCodexDeepLink: boolean;

  constructor(options: CodexDesktopVisibilityPatchServiceOptions = {}) {
    this.deepLinkVerificationIntervalMs =
      options.deepLinkVerificationIntervalMs ?? DEEP_LINK_VERIFICATION_INTERVAL_MS;
    this.deepLinkVerificationTimeoutMs =
      options.deepLinkVerificationTimeoutMs ?? DEEP_LINK_VERIFICATION_TIMEOUT_MS;
    this.env = options.env ?? process.env;
    this.globalStatePath = options.globalStatePath;
    this.homeDirectory = options.homeDirectory ?? homedir();
    this.openCodexDeepLink = options.openCodexDeepLink ?? defaultOpenCodexDeepLink;
    this.platform = options.platform ?? process.platform;
    this.shouldUseCodexDeepLink =
      options.openCodexDeepLink !== undefined || this.platform === "darwin";
  }

  ensureWorkspaceVisible = async (params: { workingDirectory?: string }): Promise<void> => {
    if (isDisabled(this.env[VISIBILITY_PATCH_ENV])) {
      return;
    }
    const workspaceRoot = normalizeWorkspaceRoot(params.workingDirectory);
    if (!workspaceRoot) {
      return;
    }
    try {
      const statePath = this.resolveGlobalStatePath();
      if (this.isWorkspaceVisible(statePath, workspaceRoot)) {
        return;
      }
      if (await this.registerWithCodexDesktop(statePath, workspaceRoot)) {
        return;
      }
      this.updateCodexGlobalState(statePath, workspaceRoot);
    } catch (error) {
      console.error(
        `[nextclaw-codex-narp] failed to patch Codex Desktop workspace visibility: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  private registerWithCodexDesktop = async (
    statePath: string,
    workspaceRoot: string,
  ): Promise<boolean> => {
    if (!this.shouldUseCodexDeepLink) {
      return false;
    }
    try {
      await this.openCodexDeepLink(buildCodexNewThreadDeepLink(workspaceRoot));
      return this.waitForWorkspaceVisibility(statePath, workspaceRoot);
    } catch {
      return false;
    }
  };

  private waitForWorkspaceVisibility = async (
    statePath: string,
    workspaceRoot: string,
  ): Promise<boolean> => {
    const deadline = Date.now() + this.deepLinkVerificationTimeoutMs;
    do {
      if (this.isWorkspaceVisible(statePath, workspaceRoot)) {
        return true;
      }
      await delay(this.deepLinkVerificationIntervalMs);
    } while (Date.now() < deadline);
    return this.isWorkspaceVisible(statePath, workspaceRoot);
  };

  private isWorkspaceVisible = (statePath: string, workspaceRoot: string): boolean => {
    const state = this.readGlobalState(statePath);
    const savedWorkspaceRoots = readStringArrayField(state, SAVED_WORKSPACE_ROOTS_KEY);
    return includesWorkspaceRoot(savedWorkspaceRoots, workspaceRoot);
  };

  private updateCodexGlobalState = (statePath: string, workspaceRoot: string): void => {
    const state = this.readGlobalState(statePath);
    const savedWorkspaceRoots = readStringArrayField(state, SAVED_WORKSPACE_ROOTS_KEY);
    const nextSavedWorkspaceRoots = prependMissingPath(savedWorkspaceRoots, workspaceRoot);

    if (nextSavedWorkspaceRoots === savedWorkspaceRoots) {
      return;
    }

    state[SAVED_WORKSPACE_ROOTS_KEY] = nextSavedWorkspaceRoots;
    this.writeGlobalState(statePath, state);
  };

  private resolveGlobalStatePath = (): string => {
    if (this.globalStatePath) {
      return this.globalStatePath;
    }
    const codexHome = readString(this.env.CODEX_HOME) ?? join(this.homeDirectory, ".codex");
    return join(codexHome, CODEX_GLOBAL_STATE_FILE_NAME);
  };

  private readGlobalState = (statePath: string): Record<string, unknown> => {
    if (!existsSync(statePath)) {
      return {};
    }
    const raw = readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error(`Codex global state is not an object: ${statePath}`);
    }
    return parsed;
  };

  private writeGlobalState = (statePath: string, state: Record<string, unknown>): void => {
    mkdirSync(dirname(statePath), { recursive: true });
    this.backupExistingState(statePath);
    const tempPath = `${statePath}.nextclaw-${randomUUID()}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(tempPath, statePath);
  };

  private backupExistingState = (statePath: string): void => {
    if (!existsSync(statePath)) {
      return;
    }
    try {
      copyFileSync(statePath, `${statePath}.nextclaw-backup`, constants.COPYFILE_EXCL);
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") {
        return;
      }
      throw error;
    }
  };
}

function buildCodexNewThreadDeepLink(workspaceRoot: string): string {
  const url = new URL("codex://new");
  url.searchParams.set("path", workspaceRoot);
  return url.toString();
}

async function defaultOpenCodexDeepLink(url: string): Promise<void> {
  await execFileAsync("open", [url]);
}

function prependMissingPath(values: string[], path: string): string[] {
  return includesWorkspaceRoot(values, path) ? values : [path, ...values];
}

function includesWorkspaceRoot(values: string[], path: string): boolean {
  return values.some((value) => normalizeWorkspaceRoot(value) === path);
}

function readStringArrayField(state: Record<string, unknown>, key: string): string[] {
  const value = state[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Codex global state field must be a string array: ${key}`);
  }
  return value;
}

function normalizeWorkspaceRoot(value: string | undefined): string | null {
  const normalized = readString(value);
  if (!normalized || !isAbsolute(normalized)) {
    return null;
  }
  const path = normalize(normalized);
  return path.length > 1 && path.endsWith(sep) ? path.slice(0, -1) : path;
}

function isDisabled(value: string | undefined): boolean {
  const normalized = readString(value)?.toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off";
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
