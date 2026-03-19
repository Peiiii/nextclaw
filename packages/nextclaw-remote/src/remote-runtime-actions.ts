import type { Config } from "@nextclaw/core";
import type {
  RemoteConnectCommandOptions,
  RemoteDoctorCommandOptions,
  RemoteEnableCommandOptions,
  RemoteStatusCommandOptions
} from "./types.js";

type RemoteConfigChange = {
  changed: boolean;
  config: Config;
};

type RemoteCommandDriver = {
  connect: (opts?: RemoteConnectCommandOptions) => Promise<void>;
  enableConfig: (opts?: RemoteEnableCommandOptions) => RemoteConfigChange;
  disableConfig: () => RemoteConfigChange;
  status: (opts?: RemoteStatusCommandOptions) => Promise<void>;
  doctor: (opts?: RemoteDoctorCommandOptions) => Promise<void>;
};

export class RemoteRuntimeActions {
  constructor(
    private readonly deps: {
      appName: string;
      initAuto: (source: string) => Promise<void>;
      remoteCommands: RemoteCommandDriver;
      restartBackgroundService: (reason: string) => Promise<boolean>;
      hasRunningManagedService: () => boolean;
    }
  ) {}

  async connect(opts: RemoteConnectCommandOptions = {}): Promise<void> {
    await this.deps.remoteCommands.connect(opts);
  }

  async enable(opts: RemoteEnableCommandOptions = {}): Promise<void> {
    await this.deps.initAuto("remote enable");
    const result = this.deps.remoteCommands.enableConfig(opts);
    console.log("✓ Remote access enabled");
    if (result.config.remote.deviceName.trim()) {
      console.log(`Device: ${result.config.remote.deviceName.trim()}`);
    }
    if (result.config.remote.platformApiBase.trim()) {
      console.log(`Platform: ${result.config.remote.platformApiBase.trim()}`);
    }
    if (this.deps.hasRunningManagedService()) {
      await this.deps.restartBackgroundService("remote configuration updated");
      console.log("✓ Applied remote settings to running background service");
      return;
    }
    console.log(`Tip: Run "${this.deps.appName} start" to bring the managed remote connector online.`);
  }

  async disable(): Promise<void> {
    const result = this.deps.remoteCommands.disableConfig();
    console.log(result.changed ? "✓ Remote access disabled" : "Remote access was already disabled");
    if (this.deps.hasRunningManagedService()) {
      await this.deps.restartBackgroundService("remote access disabled");
      console.log("✓ Running background service restarted without remote access");
    }
  }

  async status(opts: RemoteStatusCommandOptions = {}): Promise<void> {
    await this.deps.remoteCommands.status(opts);
  }

  async doctor(opts: RemoteDoctorCommandOptions = {}): Promise<void> {
    await this.deps.remoteCommands.doctor(opts);
  }
}
