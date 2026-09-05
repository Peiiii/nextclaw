import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PetDirectoryEntry, PetManifest } from "@core/features/agent/features/pet/types/pet.types.js";
import {
  hasPetManifest,
  readPetManifest,
  PET_MANIFEST_FILE_NAME,
} from "./pet-manifest.utils.js";

/** 分身 workspace 下皮目录的固定名字（与 memory/ 同级）。 */
export const PETS_DIRECTORY_NAME = "pets";

/**
 * 桌宠皮目录 store（桌宠设计 PR-A）。
 *
 * 布局：`<分身 workspace>/pets/<petId>/pet.json`。提供列表发现与指定皮读取，
 * 不承载 UI 状态（激活皮/换皮交互归属 UI feature）；非法/缺失皮由调用方降级。
 */
export class PetDirectoryStore {
  private readonly petsDir: string;

  constructor(private readonly workspace: string) {
    this.petsDir = join(workspace, PETS_DIRECTORY_NAME);
  }

  /** pets 目录路径（不存在也会返回路径，读取前用 exists 判断）。 */
  getPetsDir = (): string => this.petsDir;

  /** 写入或覆盖一个皮（含 manifest 目录与 pet.json）。 */
  writePet = (manifest: PetManifest): string => {
    const dir = join(this.petsDir, manifest.id);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, PET_MANIFEST_FILE_NAME);
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
    return path;
  };

  /** 列出 workspace 内全部有效皮（manifest 缺失/非法的目录跳过）。 */
  listPets = (): PetDirectoryEntry[] => {
    if (!existsSync(this.petsDir)) {
      return [];
    }
    const entries: PetDirectoryEntry[] = [];
    for (const entry of readdirSync(this.petsDir)) {
      const dir = join(this.petsDir, entry);
      if (!hasPetManifest(dir)) {
        continue;
      }
      try {
        entries.push({
          manifestPath: join(dir, PET_MANIFEST_FILE_NAME),
          manifest: readPetManifest(dir),
        });
      } catch {
        // 单皮损坏不影响其余皮发现
      }
    }
    return entries.sort((left, right) => left.manifest.id.localeCompare(right.manifest.id));
  };

  /** 读取指定皮；不存在或损坏返回 null（调用方降级文字桌宠/默认皮）。 */
  getPet = (petId: string): PetManifest | null => {
    const dir = join(this.petsDir, petId);
    if (!hasPetManifest(dir)) {
      return null;
    }
    try {
      return readPetManifest(dir);
    } catch {
      return null;
    }
  };
}
