import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PetManifest } from "./types/pet.types.js";
import { PetDirectoryStore, PETS_DIRECTORY_NAME } from "./utils/pet-directory.utils.js";
import { PET_MANIFEST_FILE_NAME } from "./utils/pet-manifest.utils.js";

const makeWorkspace = (): string => mkdtempSync(join(tmpdir(), "np-pet-dir-"));

const cleanup = (dir: string): void => {
  rmSync(dir, { recursive: true, force: true });
};

const mochi: PetManifest = {
  id: "mochi-claw",
  name: "小爪",
  description: "暖洋洋的爪爪桌宠",
  emoji: "🐾",
  vibe: "warm",
  catchphrase: "爪爪到，事办妥。",
};

const luna: PetManifest = {
  id: "luna-owl",
  name: "月羽",
  description: "安静的夜猫头鹰",
  emoji: "🦉",
  vibe: "calm",
};

describe("PetDirectoryStore", () => {
  it("starts empty when workspace has no pets directory", () => {
    const ws = makeWorkspace();
    try {
      const store = new PetDirectoryStore(ws);
      expect(store.listPets()).toEqual([]);
      expect(store.getPet("mochi-claw")).toBeNull();
    } finally {
      cleanup(ws);
    }
  });

  it("writes a pet manifest into pets/<petId>/pet.json", () => {
    const ws = makeWorkspace();
    try {
      const store = new PetDirectoryStore(ws);
      const path = store.writePet(mochi);
      expect(path).toContain(join(PETS_DIRECTORY_NAME, "mochi-claw", PET_MANIFEST_FILE_NAME));
      expect(store.getPet("mochi-claw")?.name).toBe("小爪");
    } finally {
      cleanup(ws);
    }
  });

  it("lists discovered pets sorted by id", () => {
    const ws = makeWorkspace();
    try {
      const store = new PetDirectoryStore(ws);
      store.writePet(mochi);
      store.writePet(luna);
      const entries = store.listPets();
      expect(entries.map((entry) => entry.manifest.id)).toEqual(["luna-owl", "mochi-claw"]);
    } finally {
      cleanup(ws);
    }
  });

  it("skips broken pet directories during discovery but keeps valid ones", () => {
    const ws = makeWorkspace();
    try {
      const store = new PetDirectoryStore(ws);
      store.writePet(mochi);
      // 造一个损坏皮目录（pet.json 非法）
      const brokenDir = join(ws, PETS_DIRECTORY_NAME, "broken-pet");
      mkdirSync(brokenDir, { recursive: true });
      writeFileSync(join(brokenDir, PET_MANIFEST_FILE_NAME), "{not json", "utf-8");
      const entries = store.listPets();
      expect(entries.map((entry) => entry.manifest.id)).toEqual(["mochi-claw"]);
    } finally {
      cleanup(ws);
    }
  });

  it("returns null for a broken pet when read directly (caller degrades)", () => {
    const ws = makeWorkspace();
    try {
      const store = new PetDirectoryStore(ws);
      const brokenDir = join(ws, PETS_DIRECTORY_NAME, "broken-pet");
      mkdirSync(brokenDir, { recursive: true });
      writeFileSync(join(brokenDir, PET_MANIFEST_FILE_NAME), "{not json", "utf-8");
      expect(store.getPet("broken-pet")).toBeNull();
    } finally {
      cleanup(ws);
    }
  });
});
