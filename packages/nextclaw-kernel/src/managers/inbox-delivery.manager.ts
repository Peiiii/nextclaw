import { randomUUID } from "node:crypto";
import { InboxDeliveryStore } from "@kernel/stores/inbox-delivery.store.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import {
  INBOX_DELIVERY_SESSION_METADATA_KEY,
  eventKeys,
  type EventBus,
  type InboxDelivery,
  type InboxDeliveryContentType,
  type InboxDeliveryContinueResult,
  type InboxDeliveryListView,
  type InboxDeliverySource,
  type InboxDeliveryStateAction,
} from "@nextclaw/shared";

const MAX_TITLE_LENGTH = 160;
const MAX_SUMMARY_LENGTH = 500;
export const MAX_INBOX_DELIVERY_CONTENT_LENGTH = 512 * 1024;

export type CreateInboxDeliveryInput = {
  title: string;
  summary?: string | null;
  content: string;
  contentType: InboxDeliveryContentType;
  source: InboxDeliverySource;
};

export type InboxDeliveryManagerOptions = {
  eventBus: Pick<EventBus, "emit">;
  sessionManager: Pick<SessionManager, "createSession" | "getSessionRecord">;
  storePath: string;
};

export type InboxDeliveryErrorCode =
  | "INBOX_DELIVERY_INVALID_CONTENT"
  | "INBOX_DELIVERY_INVALID_SUMMARY"
  | "INBOX_DELIVERY_INVALID_TITLE"
  | "INBOX_DELIVERY_NOT_FOUND";

export class InboxDeliveryError extends Error {
  constructor(
    readonly code: InboxDeliveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InboxDeliveryError";
  }
}

export function isInboxDeliveryError(error: unknown): error is InboxDeliveryError {
  return error instanceof InboxDeliveryError;
}

export class InboxDeliveryManager {
  private readonly store: InboxDeliveryStore;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: InboxDeliveryManagerOptions) {
    this.store = new InboxDeliveryStore(options.storePath);
  }

  listDeliveries = async (): Promise<InboxDeliveryListView> => {
    await this.writeQueue;
    const deliveries = (await this.store.list()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
    return {
      deliveries,
      total: deliveries.length,
      unreadCount: deliveries.filter((delivery) => !delivery.readAt && !delivery.archivedAt).length,
      unpresentedCount: deliveries.filter((delivery) =>
        !delivery.presentedAt && !delivery.readAt && !delivery.archivedAt
      ).length,
    };
  };

  getDelivery = async (deliveryId: string): Promise<InboxDelivery | null> => {
    await this.writeQueue;
    const delivery = (await this.store.list()).find(({ id }) => id === deliveryId);
    return delivery ? structuredClone(delivery) : null;
  };

  createDelivery = async (input: CreateInboxDeliveryInput): Promise<InboxDelivery> =>
    await this.mutate(async () => {
      const now = new Date().toISOString();
      const delivery: InboxDelivery = {
        id: randomUUID(),
        title: this.normalizeRequiredText(input.title, "title", MAX_TITLE_LENGTH),
        summary: this.normalizeOptionalText(input.summary, "summary", MAX_SUMMARY_LENGTH),
        content: this.normalizeRequiredText(
          input.content,
          "content",
          MAX_INBOX_DELIVERY_CONTENT_LENGTH,
        ),
        contentType: input.contentType,
        source: structuredClone(input.source),
        createdAt: now,
        updatedAt: now,
        presentedAt: null,
        readAt: null,
        archivedAt: null,
        conversationSessionId: null,
      };
      const deliveries = await this.store.list();
      await this.store.save([delivery, ...deliveries]);
      this.publishChange(delivery.id, "upsert");
      return structuredClone(delivery);
    });

  updateDeliveryState = async (
    deliveryId: string,
    action: InboxDeliveryStateAction,
  ): Promise<InboxDelivery> => await this.mutate(async () => {
    const deliveries = await this.store.list();
    const index = deliveries.findIndex(({ id }) => id === deliveryId);
    if (index < 0) {
      throw this.notFound(deliveryId);
    }
    const current = deliveries[index];
    const now = new Date().toISOString();
    const next = this.applyStateAction(current, action, now);
    deliveries[index] = next;
    await this.store.save(deliveries);
    this.publishChange(deliveryId, "upsert");
    return structuredClone(next);
  });

  deleteDelivery = async (deliveryId: string): Promise<boolean> =>
    await this.mutate(async () => {
      const deliveries = await this.store.list();
      const remaining = deliveries.filter(({ id }) => id !== deliveryId);
      if (remaining.length === deliveries.length) {
        return false;
      }
      await this.store.save(remaining);
      this.publishChange(deliveryId, "delete");
      return true;
    });

  continueInChat = async (deliveryId: string): Promise<InboxDeliveryContinueResult> =>
    await this.mutate(async () => {
      const deliveries = await this.store.list();
      const index = deliveries.findIndex(({ id }) => id === deliveryId);
      if (index < 0) {
        throw this.notFound(deliveryId);
      }
      const current = deliveries[index];
      const existingSession = current.conversationSessionId
        ? await this.options.sessionManager.getSessionRecord(current.conversationSessionId)
        : null;
      let sessionId = current.conversationSessionId;
      let created = false;
      if (!sessionId || !existingSession) {
        const session = await this.options.sessionManager.createSession({
          sourceSessionMetadata: {},
          metadataOverrides: {
            [INBOX_DELIVERY_SESSION_METADATA_KEY]: current.id,
          },
          task: `Continue discussing inbox delivery: ${current.title}`,
          title: current.title,
          agentId: current.source.agentId ?? undefined,
        });
        sessionId = session.sessionId;
        created = true;
      }
      const now = new Date().toISOString();
      const delivery: InboxDelivery = {
        ...current,
        updatedAt: now,
        presentedAt: current.presentedAt ?? now,
        readAt: current.readAt ?? now,
        conversationSessionId: sessionId,
      };
      deliveries[index] = delivery;
      await this.store.save(deliveries);
      this.publishChange(deliveryId, "upsert");
      return { delivery: structuredClone(delivery), sessionId, created };
    });

  private applyStateAction = (
    delivery: InboxDelivery,
    action: InboxDeliveryStateAction,
    now: string,
  ): InboxDelivery => {
    switch (action) {
      case "present":
        return { ...delivery, updatedAt: now, presentedAt: delivery.presentedAt ?? now };
      case "read":
        return {
          ...delivery,
          updatedAt: now,
          presentedAt: delivery.presentedAt ?? now,
          readAt: delivery.readAt ?? now,
        };
      case "mark_unread":
        return { ...delivery, updatedAt: now, readAt: null };
      case "archive":
        return {
          ...delivery,
          updatedAt: now,
          presentedAt: delivery.presentedAt ?? now,
          archivedAt: delivery.archivedAt ?? now,
        };
      case "restore":
        return { ...delivery, updatedAt: now, archivedAt: null };
    }
  };

  private normalizeRequiredText = (value: string, field: string, maxLength: number): string => {
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
      throw new InboxDeliveryError(
        field === "title" ? "INBOX_DELIVERY_INVALID_TITLE" : "INBOX_DELIVERY_INVALID_CONTENT",
        `${field} must contain between 1 and ${maxLength} characters`,
      );
    }
    return normalized;
  };

  private normalizeOptionalText = (
    value: string | null | undefined,
    field: string,
    maxLength: number,
  ): string | null => {
    const normalized = value?.trim() ?? "";
    if (normalized.length > maxLength) {
      throw new InboxDeliveryError(
        "INBOX_DELIVERY_INVALID_SUMMARY",
        `${field} must contain at most ${maxLength} characters`,
      );
    }
    return normalized || null;
  };

  private notFound = (deliveryId: string): InboxDeliveryError =>
    new InboxDeliveryError(
      "INBOX_DELIVERY_NOT_FOUND",
      `inbox delivery not found: ${deliveryId}`,
    );

  private publishChange = (
    deliveryId: string,
    operation: "upsert" | "delete",
  ): void => {
    this.options.eventBus.emit(
      eventKeys.inboxDeliveryChanged,
      { deliveryId, operation },
      { source: "inbox-delivery" },
    );
  };

  private mutate = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = this.writeQueue.then(operation, operation);
    this.writeQueue = result.then(() => undefined, () => undefined);
    return result;
  };
}
