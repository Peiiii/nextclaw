import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodexDesktopVisibilityPatchService } from "./codex-desktop-visibility-patch.service.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("CodexDesktopVisibilityPatchService", () => {
  it("registers the working directory through the Codex Desktop deep link", async () => {
    const workspaceRoot = "/Users/me/.nextclaw/workspace";
    const statePath = createGlobalState({
      "electron-saved-workspace-roots": ["/Users/me/project-a"],
      "active-workspace-roots": ["/Users/me/project-a"],
      "unknown-key": { keep: true },
    });
    const openedUrls: string[] = [];
    const service = new CodexDesktopVisibilityPatchService({
      globalStatePath: statePath,
      openCodexDeepLink: async (url) => {
        openedUrls.push(url);
        writeGlobalState(statePath, {
          "electron-saved-workspace-roots": [workspaceRoot, "/Users/me/project-a"],
          "active-workspace-roots": [workspaceRoot],
          "unknown-key": { keep: true },
        });
      },
      platform: "darwin",
    });

    await service.ensureWorkspaceVisible({
      workingDirectory: workspaceRoot,
    });

    expect(openedUrls).toEqual([
      "codex://new?path=%2FUsers%2Fme%2F.nextclaw%2Fworkspace",
    ]);
    expect(readGlobalState(statePath)).toEqual({
      "electron-saved-workspace-roots": [
        "/Users/me/.nextclaw/workspace",
        "/Users/me/project-a",
      ],
      "active-workspace-roots": ["/Users/me/.nextclaw/workspace"],
      "unknown-key": { keep: true },
    });
  });

  it("falls back to patching Codex global state when the deep link is unavailable", async () => {
    const statePath = createGlobalState({
      "electron-saved-workspace-roots": ["/Users/me/project-a"],
      "active-workspace-roots": ["/Users/me/project-a"],
      "project-order": ["/Users/me/project-a"],
      "unknown-key": { keep: true },
    });
    const service = new CodexDesktopVisibilityPatchService({
      deepLinkVerificationIntervalMs: 1,
      deepLinkVerificationTimeoutMs: 1,
      globalStatePath: statePath,
      openCodexDeepLink: async () => {},
      platform: "darwin",
    });

    await service.ensureWorkspaceVisible({
      workingDirectory: "/Users/me/.nextclaw/workspace",
    });

    expect(readGlobalState(statePath)).toEqual({
      "electron-saved-workspace-roots": [
        "/Users/me/.nextclaw/workspace",
        "/Users/me/project-a",
      ],
      "active-workspace-roots": ["/Users/me/project-a"],
      "project-order": ["/Users/me/project-a"],
      "unknown-key": { keep: true },
    });
  });

  it("does not duplicate an already registered workspace root", async () => {
    const statePath = createGlobalState({
      "electron-saved-workspace-roots": ["/Users/me/.nextclaw/workspace"],
      "active-workspace-roots": ["/Users/me/project-a"],
    });
    const openedUrls: string[] = [];
    const service = new CodexDesktopVisibilityPatchService({
      globalStatePath: statePath,
      openCodexDeepLink: async (url) => {
        openedUrls.push(url);
      },
    });

    await service.ensureWorkspaceVisible({
      workingDirectory: "/Users/me/.nextclaw/workspace/",
    });

    expect(openedUrls).toEqual([]);
    expect(readGlobalState(statePath)).toEqual({
      "electron-saved-workspace-roots": ["/Users/me/.nextclaw/workspace"],
      "active-workspace-roots": ["/Users/me/project-a"],
    });
  });

  it("can be disabled through an explicit environment switch", async () => {
    const statePath = createGlobalState({
      "electron-saved-workspace-roots": [],
      "active-workspace-roots": [],
    });
    const service = new CodexDesktopVisibilityPatchService({
      env: { NEXTCLAW_CODEX_DESKTOP_VISIBILITY_PATCH: "0" },
      globalStatePath: statePath,
    });

    await service.ensureWorkspaceVisible({
      workingDirectory: "/Users/me/.nextclaw/workspace",
    });

    expect(readGlobalState(statePath)).toEqual({
      "electron-saved-workspace-roots": [],
      "active-workspace-roots": [],
    });
  });

  it("skips non-absolute working directories", async () => {
    const statePath = createGlobalState({
      "electron-saved-workspace-roots": [],
      "active-workspace-roots": [],
    });
    const service = new CodexDesktopVisibilityPatchService({ globalStatePath: statePath });

    await service.ensureWorkspaceVisible({ workingDirectory: "relative/path" });

    expect(readGlobalState(statePath)).toEqual({
      "electron-saved-workspace-roots": [],
      "active-workspace-roots": [],
    });
  });
});

function createGlobalState(state: Record<string, unknown>): string {
  tempDir = mkdtempSync(join(tmpdir(), "nextclaw-codex-desktop-visibility-"));
  const statePath = join(tempDir, ".codex-global-state.json");
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return statePath;
}

function readGlobalState(statePath: string): unknown {
  return JSON.parse(readFileSync(statePath, "utf8"));
}

function writeGlobalState(statePath: string, state: Record<string, unknown>): void {
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
