import type { SkillId } from "@/types/entity-ids.types.js";
import type { SkillRecord } from "@/types/skill.types.js";

export class SkillManager {
  readonly listSkills = () => {
    throw new Error("SkillManager.listSkills is not implemented.");
  };

  readonly getSkill = (skillId: SkillId) => {
    void skillId;
    throw new Error("SkillManager.getSkill is not implemented.");
  };

  readonly requireSkill = (skillId: SkillId) => {
    void skillId;
    throw new Error("SkillManager.requireSkill is not implemented.");
  };

  readonly saveSkill = (skill: SkillRecord) => {
    void skill;
    throw new Error("SkillManager.saveSkill is not implemented.");
  };

  readonly enableSkill = (skillId: SkillId) => {
    void skillId;
    throw new Error("SkillManager.enableSkill is not implemented.");
  };

  readonly disableSkill = (skillId: SkillId) => {
    void skillId;
    throw new Error("SkillManager.disableSkill is not implemented.");
  };

  readonly resolveSkills = (skillIds: SkillId[]) => {
    void skillIds;
    throw new Error("SkillManager.resolveSkills is not implemented.");
  };
}
