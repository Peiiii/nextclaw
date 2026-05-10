import { eventKeys, type EventBus, type Unsubscribe } from "@nextclaw/shared";
import { extensionEventKeys } from "../configs/extension-event-keys.config.js";
import type {
  ChannelConfigChangedEvent,
  ChannelConfigGetResponse,
  ChannelNcpEvent,
  ChannelSubmittedMessage,
  ExtensionChannel,
  ExtensionChannelConfigService,
} from "../types/extension-sdk.types.js";
import type { ExtensionTransportService } from "./extension-transport.service.js";

const CONFIG_GET_EVENT_TYPE = "extension.channel.config.get";
const MESSAGE_SUBMIT_EVENT_TYPE = "extension.channel.message.submit";

function isForChannel(params: {
  expectedExtensionId: string;
  expectedChannelId: string;
  extensionId?: string;
  channelId: string;
}): boolean {
  const {
    channelId,
    expectedChannelId,
    expectedExtensionId,
    extensionId,
  } = params;
  return (
    channelId === expectedChannelId &&
    (!extensionId || extensionId === expectedExtensionId)
  );
}

class ChannelConfigService implements ExtensionChannelConfigService {
  constructor(
    private readonly params: {
      channelId: string;
      eventBus: EventBus;
      transport: ExtensionTransportService;
    },
  ) {}

  readonly get = async <TConfig = unknown>(): Promise<TConfig> => {
    const response = await this.params.transport.postWebhook<ChannelConfigGetResponse<TConfig>>(
      CONFIG_GET_EVENT_TYPE,
      { channelId: this.params.channelId },
    );
    return response.config;
  };

  readonly onChange = <TConfig = unknown>(
    handler: (config: TConfig, event: ChannelConfigChangedEvent<TConfig>) => void | Promise<void>,
  ): Unsubscribe =>
    this.params.eventBus.subscribeAll((event) => {
      if (event.type === extensionEventKeys.channelConfigChanged.id) {
        const payload = event.payload as ChannelConfigChangedEvent<TConfig>;
        if (!isForChannel({
          expectedExtensionId: this.params.transport.extensionId,
          expectedChannelId: this.params.channelId,
          extensionId: payload.extensionId,
          channelId: payload.channelId,
        })) {
          return;
        }
        void handler(payload.config, payload);
        return;
      }

      if (event.type !== eventKeys.configUpdated.id) {
        return;
      }
      const payload = event.payload as { path?: unknown };
      if (payload.path !== `channels.${this.params.channelId}`) {
        return;
      }
      void this.get<TConfig>().then((config) =>
        handler(config, {
          extensionId: this.params.transport.extensionId,
          channelId: this.params.channelId,
          config,
        }),
      );
    });
}

export class ExtensionChannelService implements ExtensionChannel {
  readonly id: string;
  readonly config: ExtensionChannelConfigService;

  constructor(
    private readonly params: {
      channelId: string;
      eventBus: EventBus;
      transport: ExtensionTransportService;
    },
  ) {
    this.id = params.channelId;
    this.config = new ChannelConfigService(params);
  }

  readonly submitMessage = async (
    input: Omit<ChannelSubmittedMessage, "channelId">,
  ): Promise<void> => {
    await this.params.transport.postWebhook(MESSAGE_SUBMIT_EVENT_TYPE, {
      ...input,
      channelId: this.id,
    });
  };

  readonly onNcpEvent = <TEvent = unknown>(
    handler: (event: TEvent, envelope: ChannelNcpEvent<TEvent>) => void | Promise<void>,
  ): Unsubscribe =>
    this.params.eventBus.on(extensionEventKeys.channelNcpEvent, (event) => {
      if (!isForChannel({
        expectedExtensionId: this.params.transport.extensionId,
        expectedChannelId: this.id,
        extensionId: event.extensionId,
        channelId: event.channelId,
      })) {
        return;
      }
      void handler(event.event as TEvent, event as ChannelNcpEvent<TEvent>);
    });
}
