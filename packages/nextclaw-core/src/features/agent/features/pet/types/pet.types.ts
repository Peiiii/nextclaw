/**
 * 桌宠皮（Pet Skin）契约类型（issue #41 周边 / 桌宠设计 PR-A）。
 *
 * 每只桌宠 = 一个"皮"：分身 workspace 下 `pets/<petId>/pet.json`。
 * 皮是纯文本/emoji 可表达的拟人化形象，无位图时可降级为文字桌宠。
 */

export type PetVibe = "warm" | "sharp" | "calm" | "playful" | "chaotic";

export type PetManifest = {
  /** 皮 id（kebab-case，目录名） */
  id: string;
  /** 桌宠名字（如 "小爪"） */
  name: string;
  /** 一句话性格/形象描述 */
  description: string;
  /** 标志性 emoji（无位图时的文字形象） */
  emoji: string;
  /** 性格气质 */
  vibe: PetVibe;
  /** 口头禅（可选） */
  catchphrase?: string;
  /** 位图/精灵图路径（可选；缺失时降级文字桌宠） */
  spritePath?: string;
};

export type PetDirectoryEntry = {
  /** pet.json 绝对路径 */
  manifestPath: string;
  manifest: PetManifest;
};
