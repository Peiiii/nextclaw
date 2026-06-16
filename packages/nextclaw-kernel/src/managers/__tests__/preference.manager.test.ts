import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { PreferenceError, PreferenceManager } from "@kernel/managers/preference.manager.js";

const tempDirs: string[] = [];

function createManager(): { manager: PreferenceManager; storePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-preference-manager-test-"));
  tempDirs.push(dir);
  const storePath = join(dir, "preferences.json");
  return {
    manager: new PreferenceManager({ storePath }),
    storePath,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("PreferenceManager", () => {
  it("persists JSON preference values by key", async () => {
    const { manager, storePath } = createManager();

    const entry = await manager.setPreference("chat.modelFavorites", [
      "openai/gpt-5.2",
      "codex/default",
    ]);
    const restored = await new PreferenceManager({ storePath })
      .getPreference("chat.modelFavorites");

    expect(entry.key).toBe("chat.modelFavorites");
    expect(restored?.value).toEqual(["openai/gpt-5.2", "codex/default"]);
    expect(await readFile(storePath, "utf8")).toContain("\"chat.modelFavorites\"");
  });

  it("deletes stored preference values", async () => {
    const { manager } = createManager();

    await manager.setPreference("chat.modelFavorites", ["openai/gpt-5.2"]);

    expect(await manager.deletePreference("chat.modelFavorites")).toBe(true);
    expect(await manager.getPreference("chat.modelFavorites")).toBeNull();
  });

  it("rejects invalid keys and non-json values", async () => {
    const { manager } = createManager();

    await expect(manager.setPreference("../bad", [])).rejects.toBeInstanceOf(PreferenceError);
    await expect(manager.setPreference("chat.bad", Number.NaN)).rejects.toBeInstanceOf(PreferenceError);
    await expect(manager.setPreference("chat.bad", new Date() as never)).rejects.toBeInstanceOf(PreferenceError);
  });
});
