import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

export class DiscordChannel extends BaseChannel<Config["channels"]["discord"]> {
  name = "discord";

  constructor(config: Config["channels"]["discord"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.token) {
      throw new Error("Discord token not configured");
    }
    throw new Error("Discord channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("Discord send not implemented");
  }
}
