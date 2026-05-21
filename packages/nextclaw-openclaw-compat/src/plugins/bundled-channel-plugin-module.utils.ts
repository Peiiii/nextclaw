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

const bundledChannelPluginModuleNames = new Set([
  "@nextclaw/channel-plugin-telegram",
  "@nextclaw/channel-plugin-whatsapp",
  "@nextclaw/channel-plugin-discord",
  "@nextclaw/channel-plugin-dingtalk",
  "@nextclaw/channel-plugin-wecom",
  "@nextclaw/channel-plugin-email",
  "@nextclaw/channel-plugin-slack"
]);

function importBundledChannelPluginModule(packageName: string): Promise<unknown> {
  return import(packageName);
}

export async function loadInProcessBundledPluginModule(
  packageName: string
): Promise<InProcessBundledPluginModule | null> {
  if (!bundledChannelPluginModuleNames.has(packageName)) {
    return null;
  }
  return createInProcessBundledPluginModule(packageName, () => importBundledChannelPluginModule(packageName));
}
