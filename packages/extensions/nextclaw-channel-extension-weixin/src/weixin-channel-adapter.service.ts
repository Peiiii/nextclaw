import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type {
  WeixinChannelAdapter,
  WeixinChannelConfig,
  WeixinInboundMessage,
} from "./weixin-extension.types.js";

export class WeixinChannelAdapterSkeleton implements WeixinChannelAdapter {
  private messageHandler: ((message: WeixinInboundMessage) => void | Promise<void>) | null = null;
  private running = false;
  private config: WeixinChannelConfig = {};

  readonly configure = async (config: WeixinChannelConfig): Promise<void> => {
    this.config = config;
  };

  readonly start = async (): Promise<void> => {
    if (this.running) {
      return;
    }
    this.running = true;
  };

  readonly stop = async (): Promise<void> => {
    if (!this.running) {
      return;
    }
    this.running = false;
  };

  readonly onMessage = (
    handler: (message: WeixinInboundMessage) => void | Promise<void>,
  ): (() => void) => {
    this.messageHandler = handler;
    return () => {
      if (this.messageHandler === handler) {
        this.messageHandler = null;
      }
    };
  };

  readonly sendNcpEvent = async (_event: NcpEndpointEvent): Promise<void> => {
    if (!this.running) {
      return;
    }
    void this.config;
  };

  readonly emitMessageForTest = async (message: WeixinInboundMessage): Promise<void> => {
    await this.messageHandler?.(message);
  };
}
