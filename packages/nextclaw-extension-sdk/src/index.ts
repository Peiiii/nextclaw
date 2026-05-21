export { NextClawExtension } from "./services/extension-client.service.js";
export { ExtensionChannelController } from "./services/extension-channel-controller.service.js";
export type {
  ChannelSubmittedMessageInput,
  ExtensionChannelAdapter,
} from "./services/extension-channel-controller.service.js";
export type {
  ChannelConfigGetRequest,
  ChannelConfigGetResponse,
  ChannelFileContent,
  ChannelImageContent,
  ChannelMessageContent,
  ChannelSubmittedMessage,
  ChannelSubmittedAttachment,
  ChannelTextContent,
  ExtensionCapabilities,
  ExtensionCapabilityHandler,
  ExtensionCapabilityPayload,
  ExtensionChannel,
  ExtensionChannelConfig,
  ExtensionChannels,
  ExtensionRequest,
  ExtensionRequestHandler,
  ExtensionRequestResponse,
  ExtensionTransportEnvelope,
  NextClawExtensionOptions,
  NextClawExtensionWebSocketLike,
} from "./types/extension-sdk.types.js";
