import type { SkillId } from "@/types/entity-ids.types.js";
import type { SkillRecord } from "@/types/skill.types.js";

export abstract class SkillManager {
  abstract listSkills(): SkillRecord[];
  abstract getSkill(skillId: SkillId): SkillRecord | null;
  abstract requireSkill(skillId: SkillId): SkillRecord;
  abstract saveSkill(skill: SkillRecord): void;
  abstract enableSkill(skillId: SkillId): void;
  abstract disableSkill(skillId: SkillId): void;
  abstract resolveSkills(skillIds: SkillId[]): SkillRecord[];
}
