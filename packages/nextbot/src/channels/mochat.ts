import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

export class MochatChannel extends BaseChannel<Config["channels"]["mochat"]> {
  name = "mochat";

  constructor(config: Config["channels"]["mochat"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.clawToken) {
      throw new Error("Mochat clawToken not configured");
    }
    throw new Error("Mochat channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("Mochat send not implemented");
  }
}
