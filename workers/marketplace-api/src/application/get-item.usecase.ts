import { ResourceNotFoundError } from "../domain/errors";
import type { MarketplaceItem, MarketplaceItemType } from "../domain/model";
import type { MarketplaceRepository } from "../domain/repository";

export class GetMarketplaceItemUseCase {
  constructor(private readonly repository: MarketplaceRepository) {}

  async execute(type: MarketplaceItemType, slug: string): Promise<MarketplaceItem> {
    const item = await this.repository.getItemBySlug(type, slug);
    if (!item) {
      throw new ResourceNotFoundError(`marketplace item not found: ${slug}`);
    }
    return item;
  }
}
