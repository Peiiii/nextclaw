import type { MarketplaceItemType, MarketplaceListQuery, MarketplaceListResult } from "../domain/model";
import type { MarketplaceRepository } from "../domain/repository";

export class ListMarketplaceItemsUseCase {
  constructor(private readonly repository: MarketplaceRepository) {}

  async execute(type: MarketplaceItemType, query: MarketplaceListQuery): Promise<MarketplaceListResult> {
    return this.repository.listItems(type, query);
  }
}
