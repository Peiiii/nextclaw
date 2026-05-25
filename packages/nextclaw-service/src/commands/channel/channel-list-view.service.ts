import type { Config } from "@nextclaw/core";
import { resolveChannelConfigView } from "./channel-config-view.utils.js";
import { listExtensionChannelIds } from "@nextclaw/kernel";

export type ChannelListEntry = {
  id: string;
  enabled: boolean;
  defaultAccountId?: string;
  accounts?: ChannelListAccount[];
};

export type ChannelListAccount = {
  id: string;
  userId?: string;
};

export type ChannelListOutput = {
  channels: ChannelListEntry[];
};

type ChannelListSource = {
  id: string;
  resolveDefaultAccountId?: (channelConfig: Record<string, unknown> | undefined) => string | undefined;
};

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export class ChannelListViewService {
  build = (params: {
    config: Config;
    workspaceDir: string;
  }): ChannelListOutput => {
    const { config, workspaceDir } = params;
    const sources = this.mergeChannelSources(
      this.toManifestChannelSources(listExtensionChannelIds({
        config,
        workspace: workspaceDir,
      })),
    );
    const channelConfig = resolveChannelConfigView(config);
    const channelConfigs = readRecord(channelConfig.channels) ?? {};
    return {
      channels: sources
        .map((source) => this.toChannelListEntry(source, channelConfigs[source.id]))
        .sort((left, right) => left.id.localeCompare(right.id))
    };
  };

  private toManifestChannelSources = (channelIds: string[]): ChannelListSource[] =>
    channelIds.map((id) => ({ id }));

  private toChannelListEntry = (source: ChannelListSource, rawChannelConfig: unknown): ChannelListEntry => {
    const channelConfig = readRecord(rawChannelConfig);
    const defaultAccountId = readString(channelConfig?.defaultAccountId) ?? source.resolveDefaultAccountId?.(channelConfig);
    const accounts = this.resolveAccounts(channelConfig);
    return {
      id: source.id,
      enabled: channelConfig?.enabled === true,
      ...(defaultAccountId ? { defaultAccountId } : {}),
      ...(accounts.length > 0 ? { accounts } : {})
    };
  };

  private resolveAccounts = (channelConfig: Record<string, unknown> | undefined): ChannelListAccount[] => {
    const accounts = readRecord(channelConfig?.accounts);
    if (!accounts) {
      return [];
    }
    return Object.entries(accounts)
      .map(([id, rawAccount]) => {
        const accountConfig = readRecord(rawAccount);
        const userId = readString(accountConfig?.userId);
        return {
          id,
          ...(userId ? { userId } : {})
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id));
  };

  private mergeChannelSources = (extensionSources: ChannelListSource[]): ChannelListSource[] => {
    const sourcesByChannelId = new Map<string, ChannelListSource>();
    for (const source of extensionSources) {
      sourcesByChannelId.set(source.id, source);
    }
    return [...sourcesByChannelId.values()];
  };
}
