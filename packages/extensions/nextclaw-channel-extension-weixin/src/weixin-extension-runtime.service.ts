import type { ExtensionChannel } from "@nextclaw/extension-sdk";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type {
  WeixinChannelAdapter,
  WeixinChannelConfig,
  WeixinInboundMessage,
} from "./weixin-extension.types.js";

export class WeixinExtensionRuntime {
  private unsubscribeConfig: (() => void) | null = null;
  private unsubscribeMessages: (() => void) | null = null;
  private unsubscribeNcpEvents: (() => void) | null = null;

  constructor(
    private readonly channel: ExtensionChannel,
    private readonly adapter: WeixinChannelAdapter,
  ) {}

  readonly start = async (): Promise<void> => {
    this.unsubscribeMessages = this.adapter.onMessage(this.submitMessage);
    this.unsubscribeNcpEvents = this.channel.onNcpEvent(this.sendNcpEvent);
    this.unsubscribeConfig = this.channel.config.onChange(async () => {
      await this.applyConfig();
    });
    await this.applyConfig();
  };

  readonly stop = async (): Promise<void> => {
    this.unsubscribeConfig?.();
    this.unsubscribeMessages?.();
    this.unsubscribeNcpEvents?.();
    this.unsubscribeConfig = null;
    this.unsubscribeMessages = null;
    this.unsubscribeNcpEvents = null;
    await this.adapter.stop();
  };

  private readonly applyConfig = async (): Promise<void> => {
    const config = await this.channel.config.get<WeixinChannelConfig>();
    await this.adapter.configure(config);
    if (config.enabled === false) {
      await this.adapter.stop();
      return;
    }
    await this.adapter.start();
  };

  private readonly submitMessage = async (message: WeixinInboundMessage): Promise<void> => {
    await this.channel.submitMessage({
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: {
        type: "text",
        text: message.text,
      },
      ...(message.attachments ? { attachments: message.attachments } : {}),
      metadata: {
        ...(message.accountId ? { accountId: message.accountId, account_id: message.accountId } : {}),
        ...(message.contextToken ? { context_token: message.contextToken } : {}),
        ...(message.raw === undefined ? {} : { raw: message.raw }),
      },
    });
  };

  private readonly sendNcpEvent = async (event: NcpEndpointEvent): Promise<void> => {
    try {
      await this.adapter.sendNcpEvent(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[weixin] failed to send NCP event: ${message}`);
    }
  };
}
