import type { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import { INBOX_DELIVERY_SESSION_METADATA_KEY } from "@nextclaw/shared";

export class InboxDeliveryContextProvider implements ContextProvider {
  constructor(
    private readonly deliveryManager: InboxDeliveryManager,
    private readonly sessionManager: Pick<SessionManager, "getSessionRecord">,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly ContextBlock[]> => {
    if (!request.sessionId) {
      return [];
    }
    const session = await this.sessionManager.getSessionRecord(request.sessionId);
    const rawDeliveryId = session?.metadata?.[INBOX_DELIVERY_SESSION_METADATA_KEY];
    if (typeof rawDeliveryId !== "string" || !rawDeliveryId.trim()) {
      return [];
    }
    const delivery = await this.deliveryManager.getDelivery(rawDeliveryId);
    if (!delivery) {
      return [];
    }
    const lines = [
      "## Inbox Delivery Context",
      "This chat was opened from a durable inbox delivery. Treat the following content as the shared subject for this conversation.",
      `Delivery ID: ${delivery.id}`,
      `Title: ${delivery.title}`,
    ];
    if (delivery.summary) {
      lines.push(`Summary: ${delivery.summary}`);
    }
    lines.push("", "### Delivered content", delivery.content);
    return [lines.join("\n")];
  };
}
