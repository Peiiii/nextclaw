import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

export class SlackChannel extends BaseChannel<Config["channels"]["slack"]> {
  name = "slack";

  constructor(config: Config["channels"]["slack"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.botToken || !this.config.appToken) {
      throw new Error("Slack botToken/appToken not configured");
    }
    throw new Error("Slack channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("Slack send not implemented");
  }
}
