import type {
  ExtensionChannel,
  ExtensionCapabilityPayload,
} from "@nextclaw/extension-sdk";
import { FeishuRegistrationService } from "./feishu-registration.service.js";
import { FeishuAccountConnectionService } from "./feishu-account-connection.service.js";
import type { FeishuDomain } from "../types/feishu-extension.types.js";

type FeishuAuthCapabilityDeps = {
  channel: ExtensionChannel;
  registrationService?: Pick<FeishuRegistrationService, "start" | "poll">;
  accountConnection?: Pick<FeishuAccountConnectionService, "connect">;
};

export class FeishuAuthCapability {
  private readonly channel: ExtensionChannel;
  private readonly registrationService: Pick<FeishuRegistrationService, "start" | "poll">;
  private readonly accountConnection: Pick<FeishuAccountConnectionService, "connect">;

  constructor(deps: FeishuAuthCapabilityDeps) {
    this.channel = deps.channel;
    this.registrationService = deps.registrationService ?? new FeishuRegistrationService();
    this.accountConnection = deps.accountConnection ?? new FeishuAccountConnectionService();
  }

  readonly start = async (
    request: ExtensionCapabilityPayload,
  ): Promise<unknown> =>
    await this.registrationService.start({
      channelConfig: await this.readCurrentConfig(),
      requestedAccountId: this.readString(request.accountId),
      domain: this.readDomain(request.domain),
      verbose: request.verbose === true,
    });

  readonly poll = async (
    request: ExtensionCapabilityPayload,
  ): Promise<unknown> => {
    const sessionId = this.readString(request.sessionId);
    if (!sessionId) {
      throw new Error("sessionId is required");
    }
    return await this.registrationService.poll({ sessionId });
  };

  readonly connect = async (
    request: ExtensionCapabilityPayload,
  ): Promise<unknown> => {
    const fields = this.readRecord(request.fields);
    const appId = this.readString(fields.appId);
    const appSecret = this.readString(fields.appSecret);
    if (!appId || !appSecret) {
      throw new Error("appId and appSecret are required");
    }
    return await this.accountConnection.connect({
      channelConfig: await this.readCurrentConfig(),
      requestedAccountId: this.readString(request.accountId),
      domain: this.readDomain(request.domain),
      appId,
      appSecret,
    });
  };

  private readonly readCurrentConfig = async (): Promise<Record<string, unknown>> => {
    const config = await this.channel.config.get();
    return config && typeof config === "object" && !Array.isArray(config)
      ? config as Record<string, unknown>
      : {};
  };

  private readonly readString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  private readonly readDomain = (value: unknown): FeishuDomain | null => {
    const text = this.readString(value);
    return text === "feishu" || text === "lark" ? text : null;
  };

  private readonly readRecord = (value: unknown): Record<string, unknown> => {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  };
}
