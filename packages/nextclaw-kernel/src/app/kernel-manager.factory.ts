import { AppDataManager } from "@kernel/managers/app-data.manager.js";
import type { AppPackageManager } from "@kernel/managers/app-package.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ChannelManager } from "@kernel/managers/channel.manager.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import type { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import type { ProviderModelCatalogManager } from "@kernel/managers/provider-model-catalog.manager.js";
import { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import {
  getWorkspacePathFromConfig,
  type DiagnosticRuntime,
  type MessageBus,
} from "@nextclaw/core";

export function createKernelOperationalManagers(params: {
  automationStorePath: string;
  configPath?: string;
  diagnostics: DiagnosticRuntime;
  messageBus: MessageBus;
  providerManager: LlmProviderManager;
  providerModelCatalogManager: ProviderModelCatalogManager;
}): {
  automation: AutomationManager;
  channels: ChannelManager;
  configManager: ConfigManager;
} {
  const {
    automationStorePath,
    configPath,
    diagnostics,
    messageBus,
    providerManager,
    providerModelCatalogManager,
  } = params;
  const channels = new ChannelManager({
    bus: messageBus,
    diagnostics,
  });
  return {
    automation: new AutomationManager({
      storePath: automationStorePath,
      diagnostics,
    }),
    channels,
    configManager: new ConfigManager({
      configPath,
      channels,
      diagnostics,
      providerManager,
      providerModelCatalogManager,
    }),
  };
}

export function createKernelServiceAppManagers(params: {
  appHomeDirectory: string;
  appPackageManager: AppPackageManager;
  configManager: ConfigManager;
}): {
  appDataManager: AppDataManager;
  serviceAppManager: ServiceAppManager;
} {
  const { appHomeDirectory, appPackageManager, configManager } = params;
  const serviceAppManager = new ServiceAppManager({
    configManager,
    listPackageComponentSources: appPackageManager.listActiveComponentSources,
  });
  return {
    serviceAppManager,
    appDataManager: new AppDataManager({
      appHomeDirectory,
      getWorkspacePath: () => getWorkspacePathFromConfig(configManager.config),
      listInstalledPackageOwners: appPackageManager.listInstalledDataOwners,
      listWorkspaceDataOwners: serviceAppManager.listWorkspaceDataOwners,
    }),
  };
}
