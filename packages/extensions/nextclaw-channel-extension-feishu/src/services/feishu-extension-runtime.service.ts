import type { ExtensionChannel } from "@nextclaw/extension-sdk";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type {
  FeishuChannelAdapterContract,
  FeishuChannelConfig,
  FeishuInboundMessage,
} from "../types/feishu-extension.types.js";

export class FeishuExtensionRuntime {
  private readonly cleanups: Array<() => void> = [];
  private started = false;

  constructor(
    private readonly channel: ExtensionChannel,
    private readonly adapter: FeishuChannelAdapterContract,
  ) {}

  readonly start = async (): Promise<void> => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(this.adapter.onMessage(this.submitMessage));
    this.cleanups.push(this.channel.onNcpEvent(this.sendNcpEvent));
    this.cleanups.push(this.channel.config.onChange(async () => {
      await this.applyConfig();
    }));
    await this.applyConfig();
  };

  readonly stop = async (): Promise<void> => {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.drainCleanups();
    await this.adapter.stop();
  };

  private readonly applyConfig = async (): Promise<void> => {
    const config = await this.channel.config.get<FeishuChannelConfig>();
    await this.adapter.configure(config);
    if (config.enabled === false) {
      await this.adapter.stop();
      return;
    }
    await this.adapter.start();
  };

  private readonly submitMessage = async (message: FeishuInboundMessage): Promise<void> => {
    await this.channel.submitMessage({
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: {
        type: "text",
        text: message.text,
      },
      metadata: {
        accountId: message.accountId,
        account_id: message.accountId,
        peerId: message.conversationId,
        peer_id: message.conversationId,
        peerKind: message.peerKind,
        peer_kind: message.peerKind,
        ...(message.messageId ? { message_id: message.messageId } : {}),
        ...(message.raw === undefined ? {} : { raw: message.raw }),
      },
    });
  };

  private readonly sendNcpEvent = async (event: NcpEndpointEvent): Promise<void> => {
    try {
      await this.adapter.sendNcpEvent(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[feishu] failed to send NCP event: ${message}`);
    }
  };

  private readonly drainCleanups = (): void => {
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      cleanup();
    }
  };
}
