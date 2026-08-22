import type {
  ExtensionChannelBinding,
  ExtensionUiMetadata,
} from "@nextclaw/core";
import type {
  ExtensionManifest,
  ExtensionRequestSender,
  ExtensionRuntimeContributions,
} from "@kernel/features/extension-runtime/types/extension-runtime.types.js";
import { ExtensionChannelClient } from "@kernel/features/extension-runtime/services/extension-channel-client.service.js";

type ExtensionContributionsServiceOptions = {
  request: ExtensionRequestSender;
};

export class ExtensionContributionsService {
  constructor(private readonly options: ExtensionContributionsServiceOptions) {}

  readonly toContributions = (
    manifests: readonly ExtensionManifest[],
  ): ExtensionRuntimeContributions => {
    const channelBindings: ExtensionChannelBinding[] = [];
    const uiMetadata: ExtensionUiMetadata[] = [];
    for (const manifest of manifests) {
      for (const channel of manifest.contributes?.channels ?? []) {
        const channelId = channel.id.trim();
        if (!channelId) continue;
        const configUiHints = this.readConfigUiHints(channel.configUiHints);
        const client = new ExtensionChannelClient({
          extensionId: manifest.id,
          channelId,
          request: this.options.request,
        });
        channelBindings.push({
          extensionId: manifest.id,
          channelId,
          channel: {
            id: channelId,
            meta: {
              label: channel.name ?? channelId,
              selectionLabel: channel.name ?? channelId,
              ...(channel.description ? { blurb: channel.description } : {}),
              ...(channel.meta ?? {}),
            },
            ...(channel.configSchema
              ? {
                  configSchema: {
                    schema: channel.configSchema,
                    ...(configUiHints ? { uiHints: configUiHints } : {}),
                  },
                }
              : {}),
            ...(channel.auth ? { auth: client } : {}),
            outbound: client,
          },
        });
        uiMetadata.push({
          id: manifest.id,
          configSchema: channel.configSchema,
          ...(configUiHints ? { configUiHints } : {}),
        });
      }
    }
    return { channelBindings, uiMetadata };
  };

  private readonly readConfigUiHints = (
    value: unknown,
  ): ExtensionUiMetadata["configUiHints"] | undefined => {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as ExtensionUiMetadata["configUiHints"])
      : undefined;
  };
}
