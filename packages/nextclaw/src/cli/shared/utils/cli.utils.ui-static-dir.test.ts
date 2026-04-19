import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveUiStaticDir } from "./cli.utils.js";

const cleanupDirs: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

describe("resolveUiStaticDir", () => {
  it("returns null when NEXTCLAW_DISABLE_STATIC_UI is enabled", () => {
    vi.stubEnv("NEXTCLAW_DISABLE_STATIC_UI", "1");
    vi.stubEnv("NEXTCLAW_UI_STATIC_DIR", "");

    expect(resolveUiStaticDir()).toBeNull();
  });

  it("uses the explicit NEXTCLAW_UI_STATIC_DIR when it points to a built frontend", () => {
    const dir = createTempDir("nextclaw-ui-static-env-");
    writeFileSync(join(dir, "index.html"), "<html></html>");
    vi.stubEnv("NEXTCLAW_UI_STATIC_DIR", dir);

    expect(resolveUiStaticDir()).toBe(dir);
  });

  it("fails instead of silently falling back when NEXTCLAW_UI_STATIC_DIR is invalid", () => {
    const dir = createTempDir("nextclaw-ui-static-invalid-");
    vi.stubEnv("NEXTCLAW_UI_STATIC_DIR", dir);

    expect(resolveUiStaticDir()).toBeNull();
  });

  it("resolves the bundled ui-dist when no explicit override is set", () => {
    vi.stubEnv("NEXTCLAW_UI_STATIC_DIR", "");

    const resolved = resolveUiStaticDir();
    expect(resolved).toBeTruthy();
    expect(resolved).toContain(`${join("packages", "nextclaw", "ui-dist")}`);
  });

  it("does not borrow the repo frontend dist from the current working directory", () => {
    const cwdRoot = createTempDir("nextclaw-ui-static-cwd-");
    const repoFrontendDist = join(cwdRoot, "packages", "nextclaw-ui", "dist");
    mkdirSync(repoFrontendDist, { recursive: true });
    writeFileSync(join(repoFrontendDist, "index.html"), "<html>repo dist</html>");
    vi.stubEnv("NEXTCLAW_UI_STATIC_DIR", "");
    const originalCwd = process.cwd();
    process.chdir(cwdRoot);

    try {
      const resolved = resolveUiStaticDir();
      expect(resolved).not.toBe(repoFrontendDist);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
