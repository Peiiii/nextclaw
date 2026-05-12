import { eventKeys, getKeyId, type EventBus, type Unsubscribe } from "@nextclaw/shared";
import type {
  ChannelConfigGetResponse,
  ChannelSubmittedMessage,
  ExtensionChannel,
  ExtensionChannelConfig,
} from "../types/extension-sdk.types.js";
import type { ExtensionTransportService } from "./extension-transport.service.js";

const CONFIG_GET_EVENT_TYPE = "extension.channel.config.get";
const MESSAGE_SUBMIT_EVENT_TYPE = "extension.channel.message.submit";

class ChannelConfig implements ExtensionChannelConfig {
  constructor(
    private readonly params: {
      channelId: string;
      eventBus: EventBus;
      transport: ExtensionTransportService;
    },
  ) {}

  readonly get = async <TConfig = unknown>(): Promise<TConfig> => {
    const response = await this.params.transport.postIngress<ChannelConfigGetResponse<TConfig>>(
      CONFIG_GET_EVENT_TYPE,
      { channelId: this.params.channelId },
    );
    return response.config;
  };

  readonly onChange = <TConfig = unknown>(
    handler: (config: TConfig) => void | Promise<void>,
  ): Unsubscribe =>
    this.params.eventBus.subscribeAll((event) => {
      if (event.type !== getKeyId(eventKeys.configUpdated)) {
        return;
      }
      const payload = event.payload as { path?: unknown };
      if (payload.path !== "channels" && payload.path !== `channels.${this.params.channelId}`) {
        return;
      }
      void this.get<TConfig>().then((config) => handler(config));
    });
}

export class ExtensionChannelService implements ExtensionChannel {
  readonly id: string;
  readonly config: ExtensionChannelConfig;

  constructor(
    private readonly params: {
      channelId: string;
      eventBus: EventBus;
      transport: ExtensionTransportService;
    },
  ) {
    this.id = params.channelId;
    this.config = new ChannelConfig(params);
  }

  readonly submitMessage = async (
    input: Omit<ChannelSubmittedMessage, "channelId">,
  ): Promise<void> => {
    await this.params.transport.postIngress(MESSAGE_SUBMIT_EVENT_TYPE, {
      ...input,
      channelId: this.id,
    });
  };

  readonly onNcpEvent = (
    handler: Parameters<ExtensionChannel["onNcpEvent"]>[0],
  ): Unsubscribe =>
    this.params.eventBus.on(eventKeys.ncpEvent, (event) => {
      void handler(event);
    });
}
