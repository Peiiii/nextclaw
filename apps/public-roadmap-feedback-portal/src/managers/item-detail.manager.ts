import { useItemDetailStore } from "../stores/item-detail.store";

export class ItemDetailManager {
  openItem = (itemId: string): void => {
    useItemDetailStore.getState().setSnapshot({ activeItemId: itemId });
  };

  closeItem = (): void => {
    useItemDetailStore.getState().setSnapshot({ activeItemId: null });
  };
}
