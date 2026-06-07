import { InvalidArgumentError, type Command } from "commander";

import type { PageController } from "@/controllers/page.controller.js";
import type { BrowserConnectorCommandOutputSink } from "@/app/register-browser-connector-commands.js";

export const registerPageCommands = (
  program: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  const page = program
    .command("page")
    .description("Read or operate a claimed browser page");

  registerPageReadCommands(page, pageController, sink);
  registerPageNavigationCommands(page, pageController, sink);
  registerPageElementCommands(page, pageController, sink);
  registerPageWaitAndLogCommands(page, pageController, sink);
};

const registerPageReadCommands = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  withOutputOptions(
    page
      .command("snapshot")
      .description("Read a bounded DOM/text snapshot")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option(
        "--interactive",
        "Include ref-addressable interactive element candidates",
        false,
      ),
  ).action(async (options) => {
    sink(await pageController.snapshot(options));
  });

  withOutputOptions(
    page
      .command("locate")
      .description("Find ref-addressable interactive candidates by text")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--text <text>", "Text, label, or placeholder to match"),
  ).action(async (options) => {
    sink(await pageController.locate(options));
  });

  withOutputOptions(
    page
      .command("inspect")
      .description("Inspect an element by selector or snapshot ref")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--selector <selector>", "CSS selector to inspect")
      .option("--ref <ref>", "Interactive ref returned by page snapshot or locate")
      .option("--frame-selector <selector>", "Same-origin iframe selector scope"),
  ).action(async (options) => {
    sink(await pageController.inspect(options));
  });

  withOutputOptions(
    page
      .command("screenshot")
      .description("Capture the visible tab viewport")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--output <file>", "Write the PNG screenshot to a file")
      .option("--include-data-url", "Keep the PNG data URL in JSON output", false),
  ).option("--full-page", "Capture the full page by scrolling and stitching", false)
    .option("--x <pixels>", "Clip x coordinate", parseNumberOption)
    .option("--y <pixels>", "Clip y coordinate", parseNumberOption)
    .option("--width <pixels>", "Clip width", parseNumberOption)
    .option("--height <pixels>", "Clip height", parseNumberOption)
    .action(async (options) => {
      sink(await pageController.screenshot(options));
    });
};

const registerPageNavigationCommands = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  for (const command of [
    ["goto", "Navigate the claimed tab to an http or https URL"],
    ["reload", "Reload the claimed tab"],
    ["back", "Navigate the claimed tab back"],
    ["forward", "Navigate the claimed tab forward"],
  ] as const) {
    const [name, description] = command;
    const pageCommand = page
      .command(name)
      .description(description)
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--reason <reason>", "Reason for the browser action");
    if (name === "goto") {
      pageCommand.requiredOption("--url <url>", "URL to open in the claimed tab");
    }
    withOutputOptions(pageCommand).action(async (options) => {
      sink(await pageController[name](options));
    });
  }
};

const registerPageElementCommands = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  registerTextEntryCommand(page, pageController, sink, "fill", "Replace an editable element value and return verified field state");
  registerTextEntryCommand(page, pageController, sink, "type", "Type text into an element by selector");
  registerTargetCommand(page, pageController, sink, "click", "Click an element by selector or snapshot ref");
  registerTargetCommand(page, pageController, sink, "check", "Check a checkbox, radio, or switch-like element");
  registerTargetCommand(page, pageController, sink, "uncheck", "Uncheck a checkbox or switch-like element");
  registerSelectCommand(page, pageController, sink);

  withOutputOptions(
    page
      .command("press")
      .description("Press keyboard keys on the page")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--keys <keys>", "Keyboard keys, for example Enter")
      .requiredOption("--reason <reason>", "Reason for the browser action")
      .option("--confirmed", "User explicitly confirmed this action", false),
  ).action(async (options) => {
    sink(await pageController.press(options));
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
    sink(await pageController.scroll(options));
  });
};

const registerTextEntryCommand = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
  name: "fill" | "type",
  description: string,
): void => {
  withOutputOptions(
    page
      .command(name)
      .description(description)
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--selector <selector>", "CSS selector to fill")
      .option("--ref <ref>", "Interactive ref returned by page snapshot or locate")
      .option("--frame-selector <selector>", "Same-origin iframe selector scope")
      .option("--mode <mode>", "Text entry mode: direct or paste", "direct")
      .requiredOption("--text <text>", "Text to fill")
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await pageController[name](options));
  });
};

const registerTargetCommand = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
  name: "click" | "check" | "uncheck",
  description: string,
): void => {
  withOutputOptions(
    page
      .command(name)
      .description(description)
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--selector <selector>", "CSS selector to click")
      .option("--ref <ref>", "Interactive ref returned by page snapshot or locate")
      .option("--frame-selector <selector>", "Same-origin iframe selector scope")
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await pageController[name](options));
  });
};

const registerSelectCommand = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  withOutputOptions(
    page
      .command("select")
      .description("Select an option on a native select element")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--selector <selector>", "CSS selector to select")
      .option("--ref <ref>", "Interactive ref returned by page snapshot or locate")
      .option("--frame-selector <selector>", "Same-origin iframe selector scope")
      .option("--value <value>", "Option value to select")
      .option("--label <label>", "Option label to select")
      .option("--index <index>", "Option index to select", parseNumberOption)
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await pageController.select(options));
  });
};

const registerPageWaitAndLogCommands = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  withOutputOptions(
    page
      .command("wait")
      .description("Wait for text on the page")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--text <text>", "Text to wait for")
      .option("--timeout-ms <ms>", "Timeout in milliseconds", parseNumberOption, 5_000)
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await pageController.wait(options));
  });

  registerWaitUrlCommand(page, pageController, sink);
  registerWaitLoadCommand(page, pageController, sink);
  registerWaitElementCommand(page, pageController, sink);

  withOutputOptions(
    page
      .command("logs")
      .description("Read current page console logs captured after instrumentation")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--level <level>", "Optional console level filter")
      .option("--limit <count>", "Maximum log entries", parseNumberOption, 20),
  ).action(async (options) => {
    sink(await pageController.logs(options));
  });
};

const registerWaitUrlCommand = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  withOutputOptions(
    page
      .command("wait-url")
      .description("Wait for the current page URL to include text")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .requiredOption("--url <url>", "URL text to wait for")
      .option("--timeout-ms <ms>", "Timeout in milliseconds", parseNumberOption, 5_000)
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await pageController.waitUrl(options));
  });
};

const registerWaitLoadCommand = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  withOutputOptions(
    page
      .command("wait-load")
      .description("Wait for document ready state")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--state <state>", "readyState to wait for", "complete")
      .option("--timeout-ms <ms>", "Timeout in milliseconds", parseNumberOption, 5_000)
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await pageController.waitLoad(options));
  });
};

const registerWaitElementCommand = (
  page: Command,
  pageController: PageController,
  sink: BrowserConnectorCommandOutputSink,
): void => {
  withOutputOptions(
    page
      .command("wait-element")
      .description("Wait for an element or text to become visible")
      .requiredOption("--lease <leaseId>", "Lease id returned by tabs claim")
      .option("--selector <selector>", "CSS selector to wait for")
      .option("--ref <ref>", "Interactive ref returned by page snapshot or locate")
      .option("--frame-selector <selector>", "Same-origin iframe selector scope")
      .option("--text <text>", "Text to wait for")
      .option("--timeout-ms <ms>", "Timeout in milliseconds", parseNumberOption, 5_000)
      .requiredOption("--reason <reason>", "Reason for the browser action"),
  ).action(async (options) => {
    sink(await pageController.waitElement(options));
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
