import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import type { SessionManager } from "../session/manager.js";

export class TelegramChannel extends BaseChannel<Config["channels"]["telegram"]> {
  name = "telegram";

  constructor(config: Config["channels"]["telegram"], bus: MessageBus, _groqKey?: string, _sessionManager?: SessionManager) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.token) {
      throw new Error("Telegram token not configured");
    }
    throw new Error("Telegram channel not yet implemented in TS version");
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(_msg: OutboundMessage): Promise<void> {
    throw new Error("Telegram send not implemented");
  }
}
