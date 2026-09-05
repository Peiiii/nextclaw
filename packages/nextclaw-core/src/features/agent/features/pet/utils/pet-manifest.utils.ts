import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PetManifest, PetVibe } from "@core/features/agent/features/pet/types/pet.types.js";

/** 皮清单文件名契约（与 panel-app.json / service-app.json 同族）。 */
export const PET_MANIFEST_FILE_NAME = "pet.json";

const PET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PET_VIBES = new Set<PetVibe>(["warm", "sharp", "calm", "playful", "chaotic"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const readRequiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`pet.json is missing required string field '${key}'.`);
  }
  return value.trim();
};

const readOptionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

export function parsePetManifest(raw: string): PetManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `pet.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(parsed)) {
    throw new Error("pet.json must contain an object.");
  }

  const id = readRequiredString(parsed, "id");
  if (!PET_ID_PATTERN.test(id)) {
    throw new Error("pet id must be kebab-case.");
  }
  const vibe = readOptionalString(parsed, "vibe") ?? "warm";
  if (!PET_VIBES.has(vibe as PetVibe)) {
    throw new Error("pet vibe must be one of warm|sharp|calm|playful|chaotic.");
  }

  return {
    id,
    name: readRequiredString(parsed, "name"),
    description: readRequiredString(parsed, "description"),
    emoji: readRequiredString(parsed, "emoji"),
    vibe: vibe as PetVibe,
    catchphrase: readOptionalString(parsed, "catchphrase"),
    spritePath: readOptionalString(parsed, "spritePath"),
  };
}

/** 读取某皮目录下的 pet.json（缺失/非法抛错，由调用方决定降级）。 */
export function readPetManifest(petDirPath: string): PetManifest {
  return parsePetManifest(readFileSync(join(petDirPath, PET_MANIFEST_FILE_NAME), "utf-8"));
}

/** 皮目录是否含 pet.json。 */
export function hasPetManifest(petDirPath: string): boolean {
  return existsSync(join(petDirPath, PET_MANIFEST_FILE_NAME));
}
