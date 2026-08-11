import type { QueryClient } from "@tanstack/react-query";
import type {
  InboxDelivery,
  InboxDeliveryListView,
  InboxDeliveryStateAction,
} from "@nextclaw/shared";
import { eventKeys } from "@nextclaw/shared";
import {
  createSystemObjectReferenceUri,
  SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
  type SystemObjectResolvedReference,
} from "@nextclaw/shared";
import { appQueryClient } from "@/app-query-client";
import { useInboxStore } from "@/features/inbox/stores/inbox.store";
import { nextclawClient } from "@/shared/lib/api";

export const INBOX_DELIVERIES_QUERY_KEY = ["inbox-deliveries"] as const;

function buildListView(deliveries: InboxDelivery[]): InboxDeliveryListView {
  return {
    deliveries,
    total: deliveries.length,
    unreadCount: deliveries.filter((delivery) => !delivery.readAt && !delivery.archivedAt).length,
    unpresentedCount: deliveries.filter((delivery) =>
      !delivery.presentedAt && !delivery.readAt && !delivery.archivedAt
    ).length,
  };
}

export class InboxManager {
  private readonly cleanups: Array<() => void> = [];
  private offerPromise: Promise<void> | null = null;
  private started = false;

  constructor(private readonly queryClient: QueryClient = appQueryClient) {}

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(
      nextclawClient.eventBus.on(
        eventKeys.inboxDeliveryChanged,
        this.handleDeliveryChanged,
      ),
    );
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
      this.cleanups.push(() =>
        document.removeEventListener("visibilitychange", this.handleVisibilityChange)
      );
    }
    this.offerPendingDelivery();
  };

  stop = (): void => {
    if (!this.started) {
      return;
    }
    this.started = false;
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  };

  closeReader = (): void => {
    useInboxStore.getState().setSnapshot({ readerOpen: false });
  };

  selectInReader = async (deliveryId: string): Promise<InboxDelivery> => {
    const delivery = await this.updateState(deliveryId, "present");
    useInboxStore.getState().setSnapshot({
      activeDeliveryId: delivery.id,
      readerOpen: true,
    });
    return delivery;
  };

  markRead = async (deliveryId: string): Promise<InboxDelivery> =>
    await this.updateState(deliveryId, "read");

  markUnread = async (deliveryId: string): Promise<InboxDelivery> =>
    await this.updateState(deliveryId, "mark_unread");

  archive = async (deliveryId: string): Promise<InboxDelivery> =>
    await this.updateState(deliveryId, "archive");

  restore = async (deliveryId: string): Promise<InboxDelivery> =>
    await this.updateState(deliveryId, "restore");

  delete = async (deliveryId: string): Promise<boolean> => {
    const deleted = await nextclawClient.inboxDeliveries.delete(deliveryId);
    if (deleted) {
      this.queryClient.setQueryData<InboxDeliveryListView>(
        INBOX_DELIVERIES_QUERY_KEY,
        (current) => current
          ? buildListView(current.deliveries.filter(({ id }) => id !== deliveryId))
          : current,
      );
      const { snapshot } = useInboxStore.getState();
      if (snapshot.activeDeliveryId === deliveryId) {
        useInboxStore.getState().setSnapshot({
          activeDeliveryId: null,
          readerOpen: false,
        });
      }
    }
    return deleted;
  };

  prepareChatReference = async (deliveryId: string): Promise<{
    delivery: InboxDelivery;
    reference: SystemObjectResolvedReference;
  }> => {
    const reference = await nextclawClient.systemObjectReferences.resolve(
      createSystemObjectReferenceUri(SYSTEM_OBJECT_TYPE_INBOX_DELIVERY, deliveryId),
    );
    const delivery = await this.updateState(deliveryId, "read");
    this.closeReader();
    return { delivery, reference };
  };

  private updateState = async (
    deliveryId: string,
    action: InboxDeliveryStateAction,
  ): Promise<InboxDelivery> => {
    const delivery = await nextclawClient.inboxDeliveries.updateState(deliveryId, action);
    this.replaceCachedDelivery(delivery);
    return delivery;
  };

  private replaceCachedDelivery = (delivery: InboxDelivery): void => {
    this.queryClient.setQueryData<InboxDeliveryListView>(
      INBOX_DELIVERIES_QUERY_KEY,
      (current) => {
        if (!current) {
          return current;
        }
        const deliveries = current.deliveries.some(({ id }) => id === delivery.id)
          ? current.deliveries.map((item) => item.id === delivery.id ? delivery : item)
          : [delivery, ...current.deliveries];
        return buildListView(deliveries);
      },
    );
  };

  private handleDeliveryChanged = (): void => {
    void this.queryClient.invalidateQueries({ queryKey: INBOX_DELIVERIES_QUERY_KEY });
    this.offerPendingDelivery();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      this.offerPendingDelivery();
    }
  };

  private offerPendingDelivery = (): void => {
    if (this.offerPromise || !this.isVisible() || useInboxStore.getState().snapshot.readerOpen) {
      return;
    }
    this.offerPromise = this.openOldestPendingDelivery()
      .catch(() => undefined)
      .finally(() => {
        this.offerPromise = null;
      });
  };

  private openOldestPendingDelivery = async (): Promise<void> => {
    const view = await this.queryClient.fetchQuery({
      queryKey: INBOX_DELIVERIES_QUERY_KEY,
      queryFn: () => nextclawClient.inboxDeliveries.list(),
      staleTime: 0,
    });
    const pending = view.deliveries.filter((delivery) =>
      !delivery.presentedAt && !delivery.readAt && !delivery.archivedAt
    );
    const delivery = pending[pending.length - 1];
    if (!delivery || !this.isVisible() || useInboxStore.getState().snapshot.readerOpen) {
      return;
    }
    await this.selectInReader(delivery.id);
  };

  private isVisible = (): boolean =>
    typeof document === "undefined" || document.visibilityState === "visible";
}
