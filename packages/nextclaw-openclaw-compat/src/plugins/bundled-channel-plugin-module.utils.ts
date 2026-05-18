import type { OpenClawPluginModule } from "./types.js";

export type InProcessBundledPluginModule = {
  entryFile: string;
  module: OpenClawPluginModule;
  rootDir: string;
};

function createVirtualBundledPluginRoot(packageName: string): string {
  return `builtin:${packageName}`;
}

async function createInProcessBundledPluginModule(
  packageName: string,
  loader: () => Promise<unknown>
): Promise<InProcessBundledPluginModule> {
  const rootDir = createVirtualBundledPluginRoot(packageName);
  return {
    entryFile: `${rootDir}/index.js`,
    rootDir,
    module: (await loader()) as OpenClawPluginModule
  };
}

const bundledChannelPluginModuleLoaders = {
  "@nextclaw/channel-plugin-telegram": () => import("@nextclaw/channel-plugin-telegram"),
  "@nextclaw/channel-plugin-whatsapp": () => import("@nextclaw/channel-plugin-whatsapp"),
  "@nextclaw/channel-plugin-discord": () => import("@nextclaw/channel-plugin-discord"),
  "@nextclaw/channel-plugin-mochat": () => import("@nextclaw/channel-plugin-mochat"),
  "@nextclaw/channel-plugin-dingtalk": () => import("@nextclaw/channel-plugin-dingtalk"),
  "@nextclaw/channel-plugin-wecom": () => import("@nextclaw/channel-plugin-wecom"),
  "@nextclaw/channel-plugin-email": () => import("@nextclaw/channel-plugin-email"),
  "@nextclaw/channel-plugin-slack": () => import("@nextclaw/channel-plugin-slack"),
  "@nextclaw/channel-plugin-qq": () => import("@nextclaw/channel-plugin-qq")
} satisfies Record<string, () => Promise<unknown>>;

export async function loadInProcessBundledPluginModule(
  packageName: string
): Promise<InProcessBundledPluginModule | null> {
  const loader = bundledChannelPluginModuleLoaders[packageName as keyof typeof bundledChannelPluginModuleLoaders];
  if (!loader) {
    return null;
  }
  return createInProcessBundledPluginModule(packageName, loader);
}
