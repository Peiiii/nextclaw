import type { MarketplaceSectionDataSource } from "../domain/repository";
import type { SkillRepository } from "../domain/skill-repository";
import { InMemorySectionRepositoryBase } from "./in-memory-section-repository-base.service";

type RepositoryOptions = {
  cacheTtlMs?: number;
};

export class InMemorySkillRepository extends InMemorySectionRepositoryBase implements SkillRepository {
  constructor(dataSource: MarketplaceSectionDataSource, options: RepositoryOptions = {}) {
    super(dataSource, options);
  }

  protected getResultType(): "skill" {
    return "skill";
  }
}
