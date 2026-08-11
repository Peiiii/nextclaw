import type { Context } from "hono";
import {
  isInboxDeliveryError,
  type InboxDeliveryManager,
} from "@nextclaw/kernel";
import type {
  InboxDeliveryStateAction,
  InboxDeliveryStateUpdate,
} from "@nextclaw/shared";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

const STATE_ACTIONS: readonly InboxDeliveryStateAction[] = [
  "present",
  "read",
  "mark_unread",
  "archive",
  "restore",
];

function isStateAction(value: unknown): value is InboxDeliveryStateAction {
  return typeof value === "string" && STATE_ACTIONS.includes(value as InboxDeliveryStateAction);
}

export class InboxDeliveriesRoutesController {
  constructor(private readonly manager: InboxDeliveryManager) {}

  readonly list = async (c: Context) =>
    c.json(ok(await this.manager.listDeliveries()));

  readonly get = async (c: Context) => {
    const delivery = await this.manager.getDelivery(c.req.param("deliveryId"));
    return delivery
      ? c.json(ok(delivery))
      : c.json(err("INBOX_DELIVERY_NOT_FOUND", "inbox delivery not found"), 404);
  };

  readonly updateState = async (c: Context) => {
    const body = await readJson<InboxDeliveryStateUpdate>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || !isStateAction(body.data.action)) {
      return c.json(err("INVALID_INBOX_DELIVERY_ACTION", "invalid inbox delivery action"), 400);
    }
    return await this.handleManagerAction(c, () =>
      this.manager.updateDeliveryState(c.req.param("deliveryId"), body.data.action)
    );
  };

  readonly delete = async (c: Context) => {
    const deliveryId = c.req.param("deliveryId");
    if (!await this.manager.deleteDelivery(deliveryId)) {
      return c.json(err("INBOX_DELIVERY_NOT_FOUND", "inbox delivery not found"), 404);
    }
    return c.json(ok({ deleted: true, deliveryId }));
  };

  private handleManagerAction = async (
    c: Context,
    action: () => Promise<unknown>,
  ) => {
    try {
      return c.json(ok(await action()));
    } catch (error) {
      if (isInboxDeliveryError(error)) {
        const status = error.code === "INBOX_DELIVERY_NOT_FOUND" ? 404 : 400;
        return c.json(err(error.code, error.message), status);
      }
      throw error;
    }
  };
}
