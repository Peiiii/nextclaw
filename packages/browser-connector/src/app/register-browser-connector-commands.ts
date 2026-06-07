import type { Command } from "commander";

import type { DoctorController } from "@/controllers/doctor.controller.js";
import type { ExtensionController } from "@/controllers/extension.controller.js";
import type { InstallController } from "@/controllers/install.controller.js";
import { registerPageCommands } from "@/app/register-browser-page-commands.js";
import type { PageController } from "@/controllers/page.controller.js";
import type { StatusController } from "@/controllers/status.controller.js";
import type { TabsController } from "@/controllers/tabs.controller.js";
import type { BrowserConnectorCommandOutput } from "@/types/cli-output.types.js";

export type BrowserConnectorCommandOutputSink = (
  output: BrowserConnectorCommandOutput,
) => void;

export type BrowserConnectorCommandControllers = {
  installController: InstallController;
  extensionController: ExtensionController;
  doctorController: DoctorController;
  statusController: StatusController;
  tabsController: TabsController;
  pageController: PageController;
};

export const registerBrowserConnectorCommands = (
  program: Command,
  controllers: BrowserConnectorCommandControllers,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  registerInstallCommands(program, controllers, sink);
  registerExtensionCommands(program, controllers, sink);
  registerSetupCommands(program, controllers, sink);
  registerDoctorCommand(program, controllers, sink);
  registerStatusCommand(program, controllers, sink);
  registerTabsCommands(program, controllers, sink);
  registerPageCommands(program, controllers.pageController, sink);
};

const registerInstallCommands = (
  program: Command,
  controllers: BrowserConnectorCommandControllers,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  const install = program
    .command("install")
    .description("Install browser connector integration files");

  withOutputOptions(
    install
      .command("chrome")
      .description("Register the Chrome Native Messaging Host")
      .option(
        "--extension-id <id>",
        "Chrome extension id. Defaults to the bundled unpacked extension id.",
      )
      .option("--open", "Open Chrome extensions page and extension directory", false),
  ).action(async (options) => {
    sink(await controllers.installController.installChrome(options));
  });

  const uninstall = program
    .command("uninstall")
    .description("Uninstall browser connector integration files");

  withOutputOptions(
    uninstall
      .command("chrome")
      .description("Remove the Chrome Native Messaging Host registration"),
  ).action(async () => {
    sink(await controllers.installController.uninstallChrome());
  });
};

const registerExtensionCommands = (
  program: Command,
  controllers: BrowserConnectorCommandControllers,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  const extension = program
    .command("extension")
    .description("Operate the Browser Connector Chrome extension");

  withOutputOptions(
    extension
      .command("reload")
      .description("Ask the connected extension to reload itself")
      .requiredOption("--reason <reason>", "Reason for reloading the extension")
      .option("--timeout-ms <ms>", "Maximum time to wait for reconnection"),
  ).action(async (options) => {
    sink(await controllers.extensionController.reload(options));
  });
};

const registerSetupCommands = (
  program: Command,
  controllers: BrowserConnectorCommandControllers,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  const setup = program
    .command("setup")
    .description("Set up browser connector integration");

  withOutputOptions(
    setup
      .command("chrome")
      .description("Register Chrome integration and report readiness")
      .option(
        "--extension-id <id>",
        "Chrome extension id. Defaults to the bundled unpacked extension id.",
      )
      .option("--open", "Open Chrome extensions page and extension directory", false),
  ).action(async (options) => {
    sink(await controllers.installController.setupChrome(options));
  });
};

const registerDoctorCommand = (
  program: Command,
  controllers: BrowserConnectorCommandControllers,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  withOutputOptions(
    program.command("doctor").description("Run browser connector diagnostics"),
  ).action(async () => {
    sink(await controllers.doctorController.run());
  });
};

const registerStatusCommand = (
  program: Command,
  controllers: BrowserConnectorCommandControllers,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  withOutputOptions(
    program.command("status").description("Read Native Host connection status"),
  ).action(async () => {
    sink(await controllers.statusController.run());
  });
};

const registerTabsCommands = (
  program: Command,
  controllers: BrowserConnectorCommandControllers,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  const tabs = program
    .command("tabs")
    .description("List, claim, and finalize browser tabs");

  withOutputOptions(tabs.command("list").description("List current Chrome tabs"))
    .action(async () => {
      sink(await controllers.tabsController.list());
    });

  withOutputOptions(
    tabs
      .command("get <tabRef>")
      .description("Read current metadata for one Chrome tab"),
  ).action(async (tabRef) => {
    sink(await controllers.tabsController.get(tabRef));
  });

  withOutputOptions(
    tabs
      .command("selected")
      .description("Read the currently selected Chrome tab"),
  ).action(async () => {
    sink(await controllers.tabsController.selected());
  });

  withOutputOptions(
    tabs
      .command("open <url>")
      .description("Open an http or https URL in a new Chrome tab")
      .requiredOption("--reason <reason>", "Reason for opening this URL")
      .option(
        "--background",
        "Open without selecting the new tab (default for AI-safe browsing)",
        false,
      )
      .option("--foreground", "Select the new tab after opening it", false),
  ).action(async (url, options) => {
    sink(await controllers.tabsController.open(url, options));
  });

  withOutputOptions(
    tabs
      .command("claim <tabRef>")
      .description("Claim a tab before reading or operating it")
      .requiredOption("--reason <reason>", "Reason for claiming this tab"),
  ).action(async (tabRef, options) => {
    sink(await controllers.tabsController.claim(tabRef, options));
  });

  withOutputOptions(
    tabs
      .command("close <tabRef>")
      .description("Close a Browser Connector-created tab, or a user tab after confirmation")
      .requiredOption("--reason <reason>", "Reason for closing this tab")
      .option("--confirmed", "User explicitly confirmed closing this tab", false),
  ).action(async (tabRef, options) => {
    sink(await controllers.tabsController.close(tabRef, options));
  });

  withOutputOptions(
    tabs
      .command("finalize")
      .description("Release an active tab lease")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim"),
  ).action(async (options) => {
    sink(await controllers.tabsController.finalize(options.lease));
  });
};

const withOutputOptions = (command: Command): Command =>
  command
    .option("--json", "Output JSON", false)
    .option("--debug", "Print debug diagnostics to stderr", false);
