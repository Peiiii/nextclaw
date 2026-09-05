import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasPetManifest,
  parsePetManifest,
  readPetManifest,
  PET_MANIFEST_FILE_NAME,
} from "./pet-manifest.utils.js";

const makePetDir = (): string => mkdtempSync(join(tmpdir(), "np-pet-manifest-"));

const cleanup = (dir: string): void => {
  rmSync(dir, { recursive: true, force: true });
};

const validRaw = JSON.stringify({
  id: "mochi-claw",
  name: "小爪",
  description: "暖洋洋的爪爪桌宠",
  emoji: "🐾",
  vibe: "warm",
  catchphrase: "爪爪到，事办妥。",
});

describe("parsePetManifest", () => {
  it("parses a valid manifest with defaults", () => {
    const manifest = parsePetManifest(validRaw);
    expect(manifest.id).toBe("mochi-claw");
    expect(manifest.name).toBe("小爪");
    expect(manifest.emoji).toBe("🐾");
    expect(manifest.vibe).toBe("warm");
    expect(manifest.catchphrase).toBe("爪爪到，事办妥。");
    expect(manifest.spritePath).toBeUndefined();
  });

  it("rejects invalid JSON", () => {
    expect(() => parsePetManifest("{not json")).toThrow(/not valid JSON/);
  });

  it("rejects non-object payload", () => {
    expect(() => parsePetManifest('["x"]')).toThrow(/must contain an object/);
  });

  it("requires kebab-case id", () => {
    expect(() =>
      parsePetManifest(JSON.stringify({ ...JSON.parse(validRaw), id: "Bad Id" })),
    ).toThrow(/kebab-case/);
  });

  it("rejects unknown vibe", () => {
    expect(() =>
      parsePetManifest(JSON.stringify({ ...JSON.parse(validRaw), vibe: "angry" })),
    ).toThrow(/vibe/);
  });

  it("defaults missing vibe to warm", () => {
    const raw = JSON.parse(validRaw) as Record<string, unknown>;
    delete raw.vibe;
    expect(parsePetManifest(JSON.stringify(raw)).vibe).toBe("warm");
  });
});

describe("readPetManifest / hasPetManifest", () => {
  it("reads pet.json from a pet directory", () => {
    const dir = makePetDir();
    try {
      writeFileSync(join(dir, PET_MANIFEST_FILE_NAME), validRaw, "utf-8");
      expect(hasPetManifest(dir)).toBe(true);
      expect(readPetManifest(dir).id).toBe("mochi-claw");
    } finally {
      cleanup(dir);
    }
  });

  it("reports false when pet.json is missing", () => {
    const dir = makePetDir();
    try {
      expect(hasPetManifest(dir)).toBe(false);
    } finally {
      cleanup(dir);
    }
  });
});
