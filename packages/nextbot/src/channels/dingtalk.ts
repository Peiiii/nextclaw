import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

export class DingTalkChannel extends BaseChannel<Config["channels"]["dingtalk"]> {
  name = "dingtalk";

  constructor(config: Config["channels"]["dingtalk"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error("DingTalk clientId/clientSecret not configured");
    }
    throw new Error("DingTalk channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("DingTalk send not implemented");
  }
}
