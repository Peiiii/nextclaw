import type { PluginRepository } from "../domain/plugin-repository";
import type { MarketplaceSectionDataSource } from "../domain/repository";
import { InMemorySectionRepositoryBase } from "./in-memory-section-repository-base.service";

type RepositoryOptions = {
  cacheTtlMs?: number;
};

export class InMemoryPluginRepository extends InMemorySectionRepositoryBase implements PluginRepository {
  constructor(dataSource: MarketplaceSectionDataSource, options: RepositoryOptions = {}) {
    super(dataSource, options);
  }

  protected getResultType(): "plugin" {
    return "plugin";
  }
}
