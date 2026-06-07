import { Command, CommanderError } from "commander";

import { DoctorController } from "@/controllers/doctor.controller.js";
import { InstallController } from "@/controllers/install.controller.js";
import { PageController } from "@/controllers/page.controller.js";
import { StatusController } from "@/controllers/status.controller.js";
import { TabsController } from "@/controllers/tabs.controller.js";
import { BrowserConnectorManager } from "@/managers/browser-connector.manager.js";
import { ConfigRepository } from "@/repositories/config.repository.js";
import { BrowserSecurityPolicyService } from "@/services/browser-security-policy.service.js";
import { BrowserSetupOpenerService } from "@/services/browser-setup-opener.service.js";
import { NativeHostRegistrationService } from "@/services/native-host-registration.service.js";
import {
  registerBrowserConnectorCommands,
  type BrowserConnectorCommandOutputSink,
} from "@/app/register-browser-connector-commands.js";
import {
  BrowserConnectorError,
  type BrowserConnectorCommandOutput,
} from "@/types/cli-output.types.js";
import { toCommandFailure } from "@/utils/error.utils.js";
import { resolveBrowserConnectorPackageVersion } from "@/utils/package-path.utils.js";

export class BrowserConnectorApp {
  constructor(
    private readonly installController: InstallController,
    private readonly doctorController: DoctorController,
    private readonly statusController: StatusController,
    private readonly tabsController: TabsController,
    private readonly pageController: PageController,
    private readonly version = resolveBrowserConnectorPackageVersion(import.meta.url),
  ) {}

  run = async (argv: string[]): Promise<BrowserConnectorCommandOutput> => {
    let commandOutput: BrowserConnectorCommandOutput | undefined;
    let commanderOut = "";
    let commanderErr = "";
    const program = this.createProgram((output) => {
      commandOutput = output;
    });

    program.configureOutput({
      writeOut: (value) => {
        commanderOut += value;
      },
      writeErr: (value) => {
        commanderErr += value;
      },
    });

    try {
      if (argv.length === 0) {
        throw new BrowserConnectorError("INVALID_ARGUMENT", "Missing command.");
      }

      await program.parseAsync(argv, { from: "user" });
      return (
        commandOutput ?? {
          ok: true,
          output: commanderOut.trim(),
        }
      );
    } catch (error) {
      if (error instanceof CommanderError) {
        return this.commanderFailure(error, commanderOut, commanderErr);
      }

      return toCommandFailure(error);
    }
  };

  private createProgram = (sink: BrowserConnectorCommandOutputSink): Command => {
    const program = new Command();
    program
      .name("browser-connector")
      .description("Local browser control connector CLI.")
      .version(this.version, "-v, --version");
    program.exitOverride();
    program.showHelpAfterError();

    registerBrowserConnectorCommands(
      program,
      {
        installController: this.installController,
        doctorController: this.doctorController,
        statusController: this.statusController,
        tabsController: this.tabsController,
        pageController: this.pageController,
      },
      sink,
    );

    return program;
  };

  private commanderFailure = (
    error: CommanderError,
    capturedOutput: string,
    capturedError: string,
  ): BrowserConnectorCommandOutput => {
    const output = capturedOutput.trim();

    if (error.exitCode === 0) {
      return {
        ok: true,
        output,
      };
    }

    return {
      ok: false,
      error: {
        code: "INVALID_ARGUMENT",
        message: capturedError.trim() || error.message,
        recoverable: false,
      },
    };
  };
}

export const createBrowserConnectorApp = (
  homeDir?: string,
): BrowserConnectorApp => {
  const configRepository = new ConfigRepository(homeDir);
  const nativeHostRegistrationService = new NativeHostRegistrationService();
  const browserConnectorManager = new BrowserConnectorManager(configRepository);

  return new BrowserConnectorApp(
    new InstallController(
      configRepository,
      nativeHostRegistrationService,
      browserConnectorManager,
      new BrowserSetupOpenerService(),
    ),
    new DoctorController(
      configRepository,
      nativeHostRegistrationService,
      browserConnectorManager,
    ),
    new StatusController(browserConnectorManager),
    new TabsController(browserConnectorManager),
    new PageController(
      browserConnectorManager,
      new BrowserSecurityPolicyService(),
    ),
  );
};
