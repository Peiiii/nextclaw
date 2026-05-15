import type { MessageBus, OutboundMessage } from "@core/features/bus/index.js";
import type { Config } from "@core/features/config/index.js";
import type { ExtensionChannelRegistration } from "@core/features/extensions/index.js";
import { BaseChannel } from "./base.js";

export class ExtensionChannelAdapter extends BaseChannel<Record<string, unknown>> {
  constructor(
    private readonly runtimeConfig: Config,
    bus: MessageBus,
    private readonly registration: ExtensionChannelRegistration
  ) {
    super({}, bus);
  }

  get name(): string {
    return this.registration.channel.id;
  }

  start = async (): Promise<void> => {
    this.running = true;
  };

  stop = async (): Promise<void> => {
    this.running = false;
  };

  send = async (msg: OutboundMessage): Promise<void> => {
    const outbound = this.registration.channel.outbound;
    if (!outbound) {
      return;
    }

    const to = msg.chatId;
    const text = msg.content;
    const accountId =
      typeof msg.metadata.accountId === "string" && msg.metadata.accountId.trim().length > 0
        ? msg.metadata.accountId
        : null;

    if (outbound.sendPayload) {
      await outbound.sendPayload({
        cfg: this.runtimeConfig,
        to,
        text,
        payload: msg.metadata.payload,
        accountId
      });
      return;
    }

    if (outbound.sendText) {
      await outbound.sendText({
        cfg: this.runtimeConfig,
        to,
        text,
        accountId
      });
      return;
    }

    throw new Error(`extension channel '${this.name}' outbound handler is not configured`);
  };
}
