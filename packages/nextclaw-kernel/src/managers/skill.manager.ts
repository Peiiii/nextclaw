import type { SkillId } from "@/types/entity-ids.types.js";
import type { SkillRecord } from "@/types/skill.types.js";

export class SkillManager {
  readonly listSkills = () => {
    // TODO(kernel): return the current skill registry snapshot.
    throw new Error("SkillManager.listSkills is not implemented.");
  };

  readonly getSkill = (skillId: SkillId) => {
    // TODO(kernel): look up a skill by id.
    void skillId;
    throw new Error("SkillManager.getSkill is not implemented.");
  };

  readonly requireSkill = (skillId: SkillId) => {
    // TODO(kernel): resolve a skill and throw a domain error when missing.
    void skillId;
    throw new Error("SkillManager.requireSkill is not implemented.");
  };

  readonly saveSkill = (skill: SkillRecord) => {
    // TODO(kernel): persist skill state.
    void skill;
    throw new Error("SkillManager.saveSkill is not implemented.");
  };

  readonly enableSkill = (skillId: SkillId) => {
    // TODO(kernel): enable skill availability.
    void skillId;
    throw new Error("SkillManager.enableSkill is not implemented.");
  };

  readonly disableSkill = (skillId: SkillId) => {
    // TODO(kernel): disable skill availability.
    void skillId;
    throw new Error("SkillManager.disableSkill is not implemented.");
  };

  readonly resolveSkills = (skillIds: SkillId[]) => {
    // TODO(kernel): resolve the effective skill set for a run.
    void skillIds;
    throw new Error("SkillManager.resolveSkills is not implemented.");
  };
}
