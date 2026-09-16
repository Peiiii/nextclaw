import type { PetManifest } from "@core/features/agent/features/pet/types/pet.types.js";

/**
 * 内置默认皮（桌宠 PR-A）。
 * 开箱即用的第一只桌宠：纯 emoji 文字形象，无需位图即可运行。
 */
export const DEFAULT_PET: PetManifest = {
  id: "mochi-claw",
  name: "小爪",
  description: "一只暖洋洋的爪爪桌宠，陪你查资料、写文件、整理表格。",
  emoji: "🐾",
  vibe: "warm",
  catchphrase: "爪爪到，事办妥。",
};

/** 默认皮 id（首次使用无皮时的回退目标）。 */
export const DEFAULT_PET_ID = DEFAULT_PET.id;
