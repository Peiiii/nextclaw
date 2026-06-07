import type { BrowserConnectorManager } from "@/managers/browser-connector.manager.js";
import type { ConfigRepository } from "@/repositories/config.repository.js";
import type { NativeHostRegistrationService } from "@/services/native-host-registration.service.js";
import type { BrowserConnectorCommandOutput } from "@/types/cli-output.types.js";
import { SUPPORTED_BROWSER_IPC_COMMANDS } from "@/types/browser-connector-json.types.js";

export class DoctorController {
  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly nativeHostRegistrationService: NativeHostRegistrationService,
    private readonly browserConnectorManager: BrowserConnectorManager,
  ) {}

  run = async (): Promise<BrowserConnectorCommandOutput> => {
    const config = await this.configRepository.readConfig();
    const nativeHost = await this.nativeHostRegistrationService.status(config);
    const checks = [
      { name: "config", ok: true },
      { name: "native-host-manifest", ok: nativeHost.installed },
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
        checks,
        nativeHost,
        status,
        nextSteps: status.connected && capabilityReady
          ? []
          : [
              "Run browser-connector extension reload --reason \"refresh extension after update\" --json.",
              "If extension reload returns UNSUPPORTED_COMMAND, reload the unpacked extension once in chrome://extensions.",
              "Then rerun browser-connector doctor --json and confirm chrome-extension-capabilities is true.",
            ],
      };
    } catch (error) {
      checks.push({ name: "native-host-ipc", ok: false });

      return {
        ok: true,
        checks,
        nativeHost,
        warning: error instanceof Error ? error.message : "Native Host unavailable.",
      };
    }
  };
}

const hasExpectedCapabilities = (
  extensionCapabilities: string[] | undefined,
): boolean =>
  SUPPORTED_BROWSER_IPC_COMMANDS.every((command) =>
    extensionCapabilities?.includes(command),
  );
