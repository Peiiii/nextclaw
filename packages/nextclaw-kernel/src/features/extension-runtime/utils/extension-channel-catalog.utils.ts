import type { Config } from "@nextclaw/core";
import {
  ExtensionManifestDiscoveryService,
  resolveExtensionManifestRoots,
} from "@kernel/features/extension-runtime/index.js";

export function listExtensionChannelIds(params: {
  config: Config;
  workspace: string;
}): string[] {
  const discovery = new ExtensionManifestDiscoveryService();
  const manifests = discovery.discoverSync(resolveExtensionManifestRoots(params));
  const channelIds: string[] = [];
  for (const manifest of manifests) {
    for (const channel of manifest.contributes?.channels ?? []) {
      const channelId = typeof channel.id === "string" ? channel.id.trim() : "";
      if (channelId && !channelIds.includes(channelId)) {
        channelIds.push(channelId);
      }
    }
  }
  return channelIds;
}
