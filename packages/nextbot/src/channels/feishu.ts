import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

export class FeishuChannel extends BaseChannel<Config["channels"]["feishu"]> {
  name = "feishu";

  constructor(config: Config["channels"]["feishu"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.appId || !this.config.appSecret) {
      throw new Error("Feishu appId/appSecret not configured");
    }
    throw new Error("Feishu channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("Feishu send not implemented");
  }
}
