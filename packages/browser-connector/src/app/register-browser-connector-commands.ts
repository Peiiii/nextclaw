import { InvalidArgumentError, type Command } from "commander";

import type { DoctorController } from "@/controllers/doctor.controller.js";
import type { InstallController } from "@/controllers/install.controller.js";
import type { PageController } from "@/controllers/page.controller.js";
import type { StatusController } from "@/controllers/status.controller.js";
import type { TabsController } from "@/controllers/tabs.controller.js";
import type { BrowserConnectorCommandOutput } from "@/types/cli-output.types.js";

export type BrowserConnectorCommandOutputSink = (
  output: BrowserConnectorCommandOutput,
) => void;

export type BrowserConnectorCommandControllers = {
  installController: InstallController;
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
  registerSetupCommands(program, controllers, sink);
  registerDoctorCommand(program, controllers, sink);
  registerStatusCommand(program, controllers, sink);
  registerTabsCommands(program, controllers, sink);
  registerPageCommands(program, controllers, sink);
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
      .command("finalize")
      .description("Release an active tab lease")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim"),
  ).action(async (options) => {
    sink(await controllers.tabsController.finalize(options.lease));
  });
};

const registerPageCommands = (
  program: Command,
  controllers: BrowserConnectorCommandControllers,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  const page = program
    .command("page")
    .description("Read or operate a claimed browser page");

  withOutputOptions(
    page
      .command("snapshot")
      .description("Read a bounded DOM/text snapshot")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim"),
  ).action(async (options) => {
    sink(await controllers.pageController.snapshot(options.lease));
  });

  withOutputOptions(
    page
      .command("screenshot")
      .description("Capture the visible tab viewport")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--output <file>", "Write the PNG screenshot to a file")
      .option("--include-data-url", "Keep the PNG data URL in JSON output", false),
  ).action(async (options) => {
    sink(await controllers.pageController.screenshot(options));
  });

  withOutputOptions(
    page
      .command("goto")
      .description("Navigate the claimed tab to an http or https URL")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--url <url>", "URL to open in the claimed tab")
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await controllers.pageController.goto(options));
  });

  withOutputOptions(
    page
      .command("reload")
      .description("Reload the claimed tab")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await controllers.pageController.reload(options));
  });

  withOutputOptions(
    page
      .command("back")
      .description("Navigate the claimed tab back")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await controllers.pageController.back(options));
  });

  withOutputOptions(
    page
      .command("forward")
      .description("Navigate the claimed tab forward")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await controllers.pageController.forward(options));
  });

  withOutputOptions(
    page
      .command("click")
      .description("Click an element by selector")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--selector <selector>", "CSS selector to click")
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await controllers.pageController.click(options));
  });

  withOutputOptions(
    page
      .command("type")
      .description("Type text into an element by selector")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--selector <selector>", "CSS selector to type into")
      .requiredOption("--text <text>", "Text to type")
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await controllers.pageController.type(options));
  });

  withOutputOptions(
    page
      .command("press")
      .description("Press keyboard keys on the page")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--keys <keys>", "Keyboard keys, for example Enter")
      .requiredOption("--reason <reason>", "Reason for the browser action")
      .option("--confirmed", "User explicitly confirmed this action", false),
  ).action(async (options) => {
    sink(await controllers.pageController.press(options));
  });

  withOutputOptions(
    page
      .command("scroll")
      .description("Scroll the page")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--x <pixels>", "Horizontal scroll delta", parseNumberOption, 0)
      .option("--y <pixels>", "Vertical scroll delta", parseNumberOption, 0)
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await controllers.pageController.scroll(options));
  });

  withOutputOptions(
    page
      .command("wait")
      .description("Wait for text on the page")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--text <text>", "Text to wait for")
      .option(
        "--timeout-ms <ms>",
        "Timeout in milliseconds",
        parseNumberOption,
        5_000,
      )
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await controllers.pageController.wait(options));
  });
};

const withOutputOptions = (command: Command): Command =>
  command
    .option("--json", "Output JSON", false)
    .option("--debug", "Print debug diagnostics to stderr", false);

const parseNumberOption = (value: string): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new InvalidArgumentError("must be a number");
  }

  return parsed;
};
