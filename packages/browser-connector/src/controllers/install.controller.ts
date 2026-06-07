import type { ConfigRepository } from "@/repositories/config.repository.js";
import type { BrowserConnectorManager } from "@/managers/browser-connector.manager.js";
import type { BrowserSetupOpenerService } from "@/services/browser-setup-opener.service.js";
import type { NativeHostRegistrationService } from "@/services/native-host-registration.service.js";
import type { BrowserConnectorCommandOutput } from "@/types/cli-output.types.js";
import { SUPPORTED_BROWSER_IPC_COMMANDS } from "@/types/browser-connector-json.types.js";

export type InstallChromeOptions = {
  extensionId?: string;
  open?: boolean;
};

export class InstallController {
  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly nativeHostRegistrationService: NativeHostRegistrationService,
    private readonly browserConnectorManager: BrowserConnectorManager,
    private readonly browserSetupOpenerService: BrowserSetupOpenerService,
  ) {}

  installChrome = async (
    options: InstallChromeOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    const config = await this.configRepository.writeConfig({
      extensionId: options.extensionId,
    });
    const nativeHost = await this.nativeHostRegistrationService.install(config);
    const openResult = options.open
      ? await this.browserSetupOpenerService.openChromeSetupTargets(
          nativeHost.extensionDir,
        )
      : undefined;

    return {
      ok: true,
      nativeHost,
      openResult,
    };
  };

  setupChrome = async (
    options: InstallChromeOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    const config = await this.configRepository.writeConfig({
      extensionId: options.extensionId,
    });
    const nativeHost = await this.nativeHostRegistrationService.install(config);
    const openResult = options.open
      ? await this.browserSetupOpenerService.openChromeSetupTargets(
          nativeHost.extensionDir,
        )
      : undefined;
    const checks = [
      { name: "native-host-manifest", ok: true },
      { name: "extension-assets", ok: true },
    ];

    try {
      const status = await this.browserConnectorManager.status();
      const capabilityReady = hasExpectedCapabilities(
        status.extensionCapabilities,
      );
      checks.push({ name: "native-host-ipc", ok: true });
      checks.push({ name: "chrome-extension", ok: status.connected });
      checks.push({
        name: "chrome-extension-capabilities",
        ok: status.connected && capabilityReady,
      });

      return {
        ok: true,
        nativeHost,
        checks,
        status,
        ready: status.connected && capabilityReady,
        openResult,
        nextSteps: status.connected && capabilityReady
          ? []
          : status.connected
            ? [
                "Reload the Browser Connector unpacked extension in chrome://extensions.",
                "Then rerun browser-connector setup chrome --json and confirm chrome-extension-capabilities is true.",
              ]
          : [
              "Open chrome://extensions.",
              `Load the unpacked extension from ${nativeHost.extensionDir}.`,
              "Reload the extension if it is already installed, then rerun browser-connector setup chrome --json.",
            ],
      };
    } catch (error) {
      checks.push({ name: "native-host-ipc", ok: false });

      return {
        ok: true,
        nativeHost,
        checks,
        ready: false,
        openResult,
        warning: error instanceof Error ? error.message : "Native Host unavailable.",
        nextSteps: [
          "Open chrome://extensions.",
          `Load the unpacked extension from ${nativeHost.extensionDir}.`,
          "After Chrome launches the Native Host, rerun browser-connector setup chrome --json.",
        ],
      };
    }
  };

  uninstallChrome = async (): Promise<BrowserConnectorCommandOutput> => {
    const config = await this.configRepository.readConfig();
    const nativeHost = await this.nativeHostRegistrationService.uninstall(config);

    return {
      ok: true,
      nativeHost,
    };
  };
}

const hasExpectedCapabilities = (
  extensionCapabilities: string[] | undefined,
): boolean =>
  SUPPORTED_BROWSER_IPC_COMMANDS.every((command) =>
    extensionCapabilities?.includes(command),
  );
