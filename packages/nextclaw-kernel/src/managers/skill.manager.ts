import type { SkillId } from "@kernel/types/entity-ids.types.js";
import type { SkillRecord } from "@kernel/types/skill.types.js";

export class SkillManager {
  listSkills = () => {
    throw new Error("SkillManager.listSkills is not implemented.");
  };

  getSkill = (skillId: SkillId) => {
    void skillId;
    throw new Error("SkillManager.getSkill is not implemented.");
  };

  requireSkill = (skillId: SkillId) => {
    void skillId;
    throw new Error("SkillManager.requireSkill is not implemented.");
  };

  saveSkill = (skill: SkillRecord) => {
    void skill;
    throw new Error("SkillManager.saveSkill is not implemented.");
  };

  enableSkill = (skillId: SkillId) => {
    void skillId;
    throw new Error("SkillManager.enableSkill is not implemented.");
  };

  disableSkill = (skillId: SkillId) => {
    void skillId;
    throw new Error("SkillManager.disableSkill is not implemented.");
  };

  resolveSkills = (skillIds: SkillId[]) => {
    void skillIds;
    throw new Error("SkillManager.resolveSkills is not implemented.");
  };
}
