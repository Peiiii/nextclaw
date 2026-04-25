import type { McpRepository } from "../domain/mcp-repository";
import type { MarketplaceSectionDataSource } from "../domain/repository";
import { InMemorySectionRepositoryBase } from "./in-memory-section-repository-base.service";

type RepositoryOptions = {
  cacheTtlMs?: number;
};

export class InMemoryMcpRepository extends InMemorySectionRepositoryBase implements McpRepository {
  constructor(dataSource: MarketplaceSectionDataSource, options: RepositoryOptions = {}) {
    super(dataSource, options);
  }

  protected getResultType(): "mcp" {
    return "mcp";
  }
}
