import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findExecutableOnPath } from "./cli.utils.js";

const cleanupDirs: string[] = [];

afterEach(() => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempPathRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-which-test-"));
  cleanupDirs.push(root);
  return root;
}

describe("findExecutableOnPath", () => {
  it("resolves executable from POSIX PATH entries", () => {
    const root = createTempPathRoot();
    const first = join(root, "first");
    const second = join(root, "second");
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });
    const binary = join(second, "npm");
    writeFileSync(binary, "#!/bin/sh\necho ok\n");

    const resolved = findExecutableOnPath("npm", { PATH: `${first}:${second}` }, "linux");
    expect(resolved).toBe(binary);
  });

  it("resolves Windows executables by PATHEXT", () => {
    const root = createTempPathRoot();
    const first = join(root, "first");
    const second = join(root, "Program Files", "nodejs");
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });
    const binary = join(second, "npm.CMD");
    writeFileSync(binary, "@echo off\r\necho ok\r\n");

    const resolved = findExecutableOnPath(
      "npm",
      {
        Path: `"${first}";"${second}"`,
        PATHEXT: ".EXE;.CMD;.BAT"
      },
      "win32"
    );
    expect(resolved).toBe(binary);
  });

  it("keeps explicit extension lookup on Windows", () => {
    const root = createTempPathRoot();
    const bin = join(root, "bin");
    mkdirSync(bin, { recursive: true });
    const binary = join(bin, "npm.cmd");
    writeFileSync(binary, "@echo off\r\necho ok\r\n");

    const resolved = findExecutableOnPath("npm.cmd", { PATH: bin }, "win32");
    expect(resolved).toBe(binary);
  });
});
