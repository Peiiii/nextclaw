import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

export class QQChannel extends BaseChannel<Config["channels"]["qq"]> {
  name = "qq";

  constructor(config: Config["channels"]["qq"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.appId || !this.config.secret) {
      throw new Error("QQ appId/secret not configured");
    }
    throw new Error("QQ channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("QQ send not implemented");
  }
}
