import type { Command } from "commander";
import type {
  RemoteConnectCommandOptions,
  RemoteDoctorCommandOptions,
  RemoteEnableCommandOptions,
  RemoteStatusCommandOptions
} from "./types.js";

type RemoteCommandRuntime = {
  enable: (opts?: RemoteEnableCommandOptions) => Promise<void>;
  disable: () => Promise<void>;
  status: (opts?: RemoteStatusCommandOptions) => Promise<void>;
  doctor: (opts?: RemoteDoctorCommandOptions) => Promise<void>;
  connect: (opts?: RemoteConnectCommandOptions) => Promise<void>;
};

export function registerRemoteCommands(program: Command, runtime: RemoteCommandRuntime): void {
  const remote = program.command("remote").description("Manage remote access");

  remote
    .command("enable")
    .description("Enable service-managed remote access")
    .option("--api-base <url>", "Platform API base (supports /v1 suffix)")
    .option("--name <name>", "Device display name")
    .action(async (opts) => runtime.enable(opts));

  remote
    .command("disable")
    .description("Disable service-managed remote access")
    .action(async () => runtime.disable());

  remote
    .command("status")
    .description("Show remote access status")
    .option("--json", "Print JSON")
    .action(async (opts) => runtime.status(opts));

  remote
    .command("doctor")
    .description("Run remote access diagnostics")
    .option("--json", "Print JSON")
    .action(async (opts) => runtime.doctor(opts));

  remote
    .command("connect")
    .description("Foreground debug mode: register this machine and keep the connector online")
    .option("--api-base <url>", "Platform API base (supports /v1 suffix)")
    .option("--local-origin <url>", "Local NextClaw UI origin (default: active service or http://127.0.0.1:18791)")
    .option("--name <name>", "Device display name")
    .option("--once", "Connect once without auto-reconnect", false)
    .action(async (opts) => runtime.connect(opts));
}
