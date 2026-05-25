import {
  eventKeys,
  getKeyId,
  ingressKeys,
  type EventBus,
  type Unsubscribe,
} from "@nextclaw/shared";
import type {
  ChannelCommandExecuteResponse,
  ChannelCommandListResponse,
  ChannelConfigGetResponse,
  ChannelSubmittedMessage,
  ExtensionChannel,
  ExtensionChannelCommands,
  ExtensionChannelConfig,
} from "../types/extension-sdk.types.js";
import type { ExtensionTransportService } from "./extension-transport.service.js";

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
      getKeyId(ingressKeys.extension.channelConfigGet),
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

class ChannelCommands implements ExtensionChannelCommands {
  constructor(
    private readonly params: {
      channelId: string;
      transport: ExtensionTransportService;
    },
  ) {}

  readonly list = async () => {
    const response = await this.params.transport.postIngress<ChannelCommandListResponse>(
      getKeyId(ingressKeys.extension.channelCommandList),
      { channelId: this.params.channelId },
    );
    return response.commands;
  };

  readonly execute = async (input: {
    commandName: string;
    args?: Record<string, unknown>;
    conversationId: string;
    senderId: string;
    metadata?: Record<string, unknown>;
  }): Promise<ChannelCommandExecuteResponse> =>
    await this.params.transport.postIngress<ChannelCommandExecuteResponse>(
      getKeyId(ingressKeys.extension.channelCommandExecute),
      {
        channelId: this.params.channelId,
        commandName: input.commandName,
        args: input.args ?? {},
        conversationId: input.conversationId,
        senderId: input.senderId,
        metadata: input.metadata ?? {},
      },
    );

  readonly executeText = async (input: {
    rawText: string;
    conversationId: string;
    senderId: string;
    metadata?: Record<string, unknown>;
  }): Promise<ChannelCommandExecuteResponse | null> => {
    const rawText = input.rawText.trim();
    if (!rawText.startsWith("/")) {
      return null;
    }
    return await this.params.transport.postIngress<ChannelCommandExecuteResponse>(
      getKeyId(ingressKeys.extension.channelCommandExecute),
      {
        channelId: this.params.channelId,
        rawText,
        conversationId: input.conversationId,
        senderId: input.senderId,
        metadata: input.metadata ?? {},
      },
    );
  };
}

export class ExtensionChannelService implements ExtensionChannel {
  readonly id: string;
  readonly config: ExtensionChannelConfig;
  readonly commands: ExtensionChannelCommands;

  constructor(
    private readonly params: {
      channelId: string;
      eventBus: EventBus;
      transport: ExtensionTransportService;
    },
  ) {
    this.id = params.channelId;
    this.config = new ChannelConfig(params);
    this.commands = new ChannelCommands(params);
  }

  readonly submitMessage = async (
    input: Omit<ChannelSubmittedMessage, "channelId">,
  ): Promise<void> => {
    await this.params.transport.postIngress(getKeyId(ingressKeys.extension.channelMessageSubmit), {
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
