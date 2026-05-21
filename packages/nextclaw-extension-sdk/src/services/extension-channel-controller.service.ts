import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type {
  ChannelSubmittedMessage,
  ExtensionChannel,
} from "../types/extension-sdk.types.js";

export type ExtensionChannelAdapter<TConfig, TInbound> = {
  configure: (config: TConfig) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onMessage: (handler: (message: TInbound) => void | Promise<void>) => () => void;
  sendNcpEvent: (event: NcpEndpointEvent) => Promise<void>;
  sendOutboundText?: (params: {
    to: string;
    text: string;
    accountId?: string | null;
  }) => Promise<void>;
};

export type ChannelSubmittedMessageInput =
  Omit<ChannelSubmittedMessage, "channelId">;

export type ExtensionChannelInboundMapper<TInbound> =
  (message: TInbound) => ChannelSubmittedMessageInput | Promise<ChannelSubmittedMessageInput>;

export type ExtensionChannelControllerOptions<TConfig, TInbound> = {
  channel: ExtensionChannel;
  adapter: ExtensionChannelAdapter<TConfig, TInbound>;
  mapInbound: ExtensionChannelInboundMapper<TInbound>;
  onNcpEventError?: (error: unknown, event: NcpEndpointEvent) => void | Promise<void>;
};

function defaultChannelEnabled(config: unknown): boolean {
  return !(
    config &&
    typeof config === "object" &&
    !Array.isArray(config) &&
    (config as { enabled?: unknown }).enabled === false
  );
}

export class ExtensionChannelController<TConfig, TInbound> {
  private readonly cleanups: Array<() => void> = [];
  private started = false;

  constructor(
    private readonly options: ExtensionChannelControllerOptions<TConfig, TInbound>,
  ) {}

  start = async (): Promise<void> => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(this.options.adapter.onMessage(this.submitMessage));
    this.cleanups.push(this.options.channel.onNcpEvent(this.sendNcpEvent));
    this.cleanups.push(this.options.channel.config.onChange(async () => {
      await this.applyConfig();
    }));
    await this.applyConfig();
  };

  stop = async (): Promise<void> => {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.drainCleanups();
    await this.options.adapter.stop();
  };

  sendOutboundText = async (params: {
    to: string;
    text: string;
    accountId?: string | null;
  }): Promise<{ accepted: true }> => {
    if (!this.options.adapter.sendOutboundText) {
      throw new Error(`channel "${this.options.channel.id}" does not support outbound text`);
    }
    await this.options.adapter.sendOutboundText(params);
    return { accepted: true };
  };

  private applyConfig = async (): Promise<void> => {
    const config = await this.options.channel.config.get<TConfig>();
    await this.options.adapter.configure(config);
    if (defaultChannelEnabled(config) === false) {
      await this.options.adapter.stop();
      return;
    }
    await this.options.adapter.start();
  };

  private submitMessage = async (message: TInbound): Promise<void> => {
    await this.options.channel.submitMessage(await this.options.mapInbound(message));
  };

  private sendNcpEvent = async (event: NcpEndpointEvent): Promise<void> => {
    try {
      await this.options.adapter.sendNcpEvent(event);
    } catch (error) {
      await this.options.onNcpEventError?.(error, event);
    }
  };

  private drainCleanups = (): void => {
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      cleanup();
    }
  };
}
