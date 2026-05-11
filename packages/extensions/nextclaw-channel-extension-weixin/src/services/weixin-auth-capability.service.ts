import type {
  ExtensionChannel,
  ExtensionCapabilityPayload,
} from "@nextclaw/extension-sdk";
import { WeixinLoginService } from "./weixin-login.service.js";

type WeixinAuthCapabilityDeps = {
  channel: ExtensionChannel;
  loginService?: Pick<WeixinLoginService, "start" | "poll" | "login">;
};

export class WeixinAuthCapability {
  private readonly channel: ExtensionChannel;
  private readonly loginService: Pick<WeixinLoginService, "start" | "poll" | "login">;

  constructor(deps: WeixinAuthCapabilityDeps) {
    this.channel = deps.channel;
    this.loginService = deps.loginService ?? new WeixinLoginService();
  }

  readonly start = async (
    request: ExtensionCapabilityPayload,
  ): Promise<unknown> =>
    await this.loginService.start({
      pluginConfig: await this.readCurrentConfig(),
      requestedAccountId: this.readString(request.accountId),
      baseUrl: this.readString(request.baseUrl),
    });

  readonly poll = async (
    request: ExtensionCapabilityPayload,
  ): Promise<unknown> => {
    const sessionId = this.readString(request.sessionId);
    if (!sessionId) {
      throw new Error("sessionId is required");
    }
    return await this.loginService.poll({ sessionId });
  };

  readonly login = async (
    request: ExtensionCapabilityPayload,
  ): Promise<unknown> =>
    await this.loginService.login({
      pluginConfig: await this.readCurrentConfig(),
      requestedAccountId: this.readString(request.accountId),
      baseUrl: this.readString(request.baseUrl),
      verbose: request.verbose === true,
    });

  private readonly readCurrentConfig = async (): Promise<Record<string, unknown>> => {
    const config = await this.channel.config.get();
    return config && typeof config === "object" && !Array.isArray(config)
      ? config as Record<string, unknown>
      : {};
  };

  private readonly readString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;
}
