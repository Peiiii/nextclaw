import type { Command } from "commander";
import type { ServiceCommands } from "../commands/service.js";

type RegisterServiceCommandsParams = {
  program: Command;
  getServiceCommands: () => ServiceCommands;
};

export const registerServiceCommands = ({
  program,
  getServiceCommands,
}: RegisterServiceCommandsParams): void => {
  const service = program.command("service").description("Manage host service integrations");

  service
    .command("install-systemd")
    .description("Install a managed Linux systemd service for NextClaw")
    .option("--user", "Install a user-level systemd unit", false)
    .option("--system", "Install a system-wide systemd unit", false)
    .option("--dry-run", "Show what would be installed without making changes", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => getServiceCommands().installSystemd(opts));

  service
    .command("uninstall-systemd")
    .description("Remove a managed Linux systemd service for NextClaw")
    .option("--user", "Remove a user-level systemd unit", false)
    .option("--system", "Remove a system-wide systemd unit", false)
    .option("--dry-run", "Show what would be removed without making changes", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => getServiceCommands().uninstallSystemd(opts));

  service
    .command("install-launch-agent")
    .description("Install a managed macOS LaunchAgent for NextClaw")
    .option("--dry-run", "Show what would be installed without making changes", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => getServiceCommands().installLaunchAgent(opts));

  service
    .command("uninstall-launch-agent")
    .description("Remove a managed macOS LaunchAgent for NextClaw")
    .option("--dry-run", "Show what would be removed without making changes", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => getServiceCommands().uninstallLaunchAgent(opts));

  service
    .command("install-task")
    .description("Install a managed Windows Scheduled Task for NextClaw")
    .option("--dry-run", "Show what would be installed without making changes", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => getServiceCommands().installWindowsTask(opts));

  service
    .command("uninstall-task")
    .description("Remove a managed Windows Scheduled Task for NextClaw")
    .option("--dry-run", "Show what would be removed without making changes", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => getServiceCommands().uninstallWindowsTask(opts));

  const autostart = service.command("autostart").description("Inspect host autostart status");

  autostart
    .command("status")
    .description("Show host autostart status")
    .option("--user", "Inspect the user-level autostart owner", false)
    .option("--system", "Inspect the system-level autostart owner", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => getServiceCommands().autostartStatus(opts));

  autostart
    .command("doctor")
    .description("Diagnose host autostart setup")
    .option("--user", "Inspect the user-level autostart owner", false)
    .option("--system", "Inspect the system-level autostart owner", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => getServiceCommands().autostartDoctor(opts));
};
