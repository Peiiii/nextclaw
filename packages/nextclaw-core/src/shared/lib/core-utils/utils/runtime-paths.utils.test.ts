import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getRunPath, getRuntimeLogsPath } from "./runtime-paths.utils.js";

const originalHome = process.env.NEXTCLAW_HOME;
const originalRunHome = process.env.NEXTCLAW_RUN_HOME;

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("runtime path helpers", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.NEXTCLAW_HOME;
    } else {
      process.env.NEXTCLAW_HOME = originalHome;
    }
    if (originalRunHome === undefined) {
      delete process.env.NEXTCLAW_RUN_HOME;
    } else {
      process.env.NEXTCLAW_RUN_HOME = originalRunHome;
    }
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("separates runtime state from data home when NEXTCLAW_RUN_HOME is set", () => {
    const dataHome = createTempDir("nextclaw-data-home-");
    const runHome = createTempDir("nextclaw-run-home-");
    tempDirs.push(dataHome, runHome);
    process.env.NEXTCLAW_HOME = dataHome;
    process.env.NEXTCLAW_RUN_HOME = runHome;

    expect(getRunPath()).toBe(runHome);
    expect(getRuntimeLogsPath()).toBe(join(runHome, "logs"));
  });
});
