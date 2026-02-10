import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

export class EmailChannel extends BaseChannel<Config["channels"]["email"]> {
  name = "email";

  constructor(config: Config["channels"]["email"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.consentGranted) {
      throw new Error("Email consent not granted (consentGranted=false)");
    }
    throw new Error("Email channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("Email send not implemented");
  }
}
