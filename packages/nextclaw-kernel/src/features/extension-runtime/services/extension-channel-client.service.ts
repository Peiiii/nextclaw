import type {
  ExtensionChannelAuthConnectResult,
  ExtensionChannelAuthStartResult,
  ExtensionChannelBinding,
} from "@nextclaw/core";
import type { ExtensionRequestSender } from "@kernel/features/extension-runtime/types/extension-runtime.types.js";
import {
  normalizeAuthLoginResult,
  normalizeAuthPollResult,
} from "@kernel/features/extension-runtime/utils/extension-runtime-payload.utils.js";

type ExtensionChannelAuthClient = NonNullable<ExtensionChannelBinding["channel"]["auth"]>;
type ExtensionChannelOutbound = NonNullable<ExtensionChannelBinding["channel"]["outbound"]>;

export class ExtensionChannelClient implements ExtensionChannelAuthClient, ExtensionChannelOutbound {
  constructor(
    private readonly params: {
      extensionId: string;
      channelId: string;
      request: ExtensionRequestSender;
    },
  ) {}

  readonly login: ExtensionChannelAuthClient["login"] = async ({ accountId, baseUrl, verbose }) =>
    normalizeAuthLoginResult(await this.params.request({
      extensionId: this.params.extensionId,
      kind: "channel.auth.login",
      payload: {
        channelId: this.params.channelId,
        accountId,
        baseUrl,
        verbose,
      },
    }));

  readonly start: ExtensionChannelAuthClient["start"] = async (params) =>
    await this.params.request<ExtensionChannelAuthStartResult>({
      extensionId: this.params.extensionId,
      kind: "channel.auth.start",
      payload: {
        channelId: this.params.channelId,
        accountId: params.accountId,
        baseUrl: params.baseUrl,
        domain: (params as { domain?: string | null }).domain,
      },
    });

  readonly connect: ExtensionChannelAuthClient["connect"] = async (params) =>
    normalizeAuthPollResult(await this.params.request<ExtensionChannelAuthConnectResult>({
      extensionId: this.params.extensionId,
      kind: "channel.auth.connect",
      payload: {
        channelId: this.params.channelId,
        accountId: params.accountId,
        domain: params.domain,
        fields: params.fields,
      },
    })) as ExtensionChannelAuthConnectResult;

  readonly poll: ExtensionChannelAuthClient["poll"] = async ({ sessionId }) =>
    normalizeAuthPollResult(await this.params.request({
      extensionId: this.params.extensionId,
      kind: "channel.auth.poll",
      payload: {
        channelId: this.params.channelId,
        sessionId,
      },
    }));

  readonly sendText: ExtensionChannelOutbound["sendText"] = async ({ to, text, accountId, replyTo, media, metadata }) =>
    await this.params.request({
      extensionId: this.params.extensionId,
      kind: "channel.outbound.sendText",
      payload: {
        channelId: this.params.channelId,
        to,
        text,
        accountId,
        replyTo,
        media,
        metadata,
      },
    });
}
