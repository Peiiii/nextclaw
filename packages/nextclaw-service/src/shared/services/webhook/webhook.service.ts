import type {
  UiWebhookContext,
  UiWebhookEnvelope,
  UiWebhookHost,
} from "@nextclaw/server";

export type WebhookHandler = (
  envelope: UiWebhookEnvelope,
  context: UiWebhookContext,
) => Promise<unknown> | unknown;

export class WebhookService implements UiWebhookHost {
  private readonly handlers = new Map<string, WebhookHandler>();

  readonly addHandler = (type: string, handler: WebhookHandler): void => {
    const normalizedType = type.trim();
    if (!normalizedType) {
      throw new Error("webhook type is required");
    }
    this.handlers.set(normalizedType, handler);
  };

  readonly handleWebhook = async (
    envelope: UiWebhookEnvelope,
    context: UiWebhookContext,
  ): Promise<unknown> => {
    const handler = this.handlers.get(envelope.type);
    if (!handler) {
      throw new Error(`Unsupported webhook type: ${envelope.type}`);
    }
    return await handler(envelope, context);
  };
}
