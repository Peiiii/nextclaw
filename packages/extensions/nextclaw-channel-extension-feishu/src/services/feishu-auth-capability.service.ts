import type {
  ExtensionChannel,
  ExtensionCapabilityPayload,
} from "@nextclaw/extension-sdk";
import { FeishuRegistrationService } from "./feishu-registration.service.js";
import type { FeishuDomain } from "../types/feishu-extension.types.js";

type FeishuAuthCapabilityDeps = {
  channel: ExtensionChannel;
  registrationService?: Pick<FeishuRegistrationService, "start" | "poll">;
};

export class FeishuAuthCapability {
  private readonly channel: ExtensionChannel;
  private readonly registrationService: Pick<FeishuRegistrationService, "start" | "poll">;

  constructor(deps: FeishuAuthCapabilityDeps) {
    this.channel = deps.channel;
    this.registrationService = deps.registrationService ?? new FeishuRegistrationService();
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
}
