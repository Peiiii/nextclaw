import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

export class WhatsAppChannel extends BaseChannel<Config["channels"]["whatsapp"]> {
  name = "whatsapp";

  constructor(config: Config["channels"]["whatsapp"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    throw new Error("WhatsApp channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("WhatsApp send not implemented");
  }
}
