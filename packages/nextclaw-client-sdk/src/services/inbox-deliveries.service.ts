import type {
  InboxDelivery,
  InboxDeliveryContinueResult,
  InboxDeliveryListView,
  InboxDeliveryStateAction,
} from "@nextclaw/shared";
import type { RequestService } from "./request.service.js";

export class InboxDeliveriesService {
  constructor(private readonly requestService: RequestService) {}

  readonly list = async (): Promise<InboxDeliveryListView> =>
    await this.requestService.get<InboxDeliveryListView>("/api/inbox/deliveries");

  readonly get = async (deliveryId: string): Promise<InboxDelivery> =>
    await this.requestService.get<InboxDelivery>(this.deliveryPath(deliveryId));

  readonly updateState = async (
    deliveryId: string,
    action: InboxDeliveryStateAction,
  ): Promise<InboxDelivery> => await this.requestService.request<InboxDelivery>(
    this.deliveryPath(deliveryId),
    { method: "PATCH", body: { action } },
  );

  readonly delete = async (deliveryId: string): Promise<boolean> => {
    const result = await this.requestService.delete<{ deleted: boolean }>(
      this.deliveryPath(deliveryId),
    );
    return result.deleted;
  };

  readonly continueInChat = async (
    deliveryId: string,
  ): Promise<InboxDeliveryContinueResult> =>
    await this.requestService.post<InboxDeliveryContinueResult>(
      `${this.deliveryPath(deliveryId)}/continue`,
    );

  private deliveryPath = (deliveryId: string): string =>
    `/api/inbox/deliveries/${encodeURIComponent(deliveryId)}`;
}
