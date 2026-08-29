import type { Command } from "commander";
import { AppCallCommandController } from "./controllers/app-call-command.controller.js";
import { AppBuildCommandController } from "./controllers/development/app-build-command.controller.js";
import { AppCheckCommandController } from "./controllers/app-check-command.controller.js";
import { AppCreateCommandController } from "./controllers/development/app-create-command.controller.js";
import { AppDoctorCommandController } from "./controllers/development/app-doctor-command.controller.js";
import { AppDevCommandController } from "./controllers/app-dev-command.controller.js";
import { AppDataCommandController } from "./controllers/app-data-command.controller.js";
import { AppRestartCommandController } from "./controllers/app-restart-command.controller.js";
import { AppPackCommandController } from "./controllers/app-pack-command.controller.js";
import { AppPublishCommandController } from "./controllers/app-publish-command.controller.js";
import { AppValidatePublishCommandController } from "./controllers/app-validate-publish-command.controller.js";
import { AppTestCommandController } from "./controllers/development/app-test-command.controller.js";
import { AppPackageCommandController } from "./controllers/app-packages/app-package-command.controller.js";
import { ServiceAppDevService } from "./services/service-app-dev.service.js";
import { AppCheckService } from "./services/app-check.service.js";

export function registerAppCommands(
  program: Command,
  options: { portableServiceRunnerPath?: string } = {},
): void {
  const app = program
    .command("app")
    .description("Develop, validate, and publish NextClaw apps");
  const serviceAppDev = new ServiceAppDevService({
    portableServiceRunnerPath: options.portableServiceRunnerPath,
  });
  const appCheckService = new AppCheckService(
    undefined,
    undefined,
    serviceAppDev,
  );
  const appCheck = new AppCheckCommandController(appCheckService);
  const appBuild = new AppBuildCommandController();
  const appCreate = new AppCreateCommandController();
  const appDoctor = new AppDoctorCommandController();
  const appDev = new AppDevCommandController(serviceAppDev);
  const appData = new AppDataCommandController();
  const appCall = new AppCallCommandController(serviceAppDev);
  const appRestart = new AppRestartCommandController();
  const appPack = new AppPackCommandController(undefined, appCheckService);
  const appValidatePublish = new AppValidatePublishCommandController();
  const appPublish = new AppPublishCommandController();
  const appPackages = new AppPackageCommandController();
  const appTest = new AppTestCommandController(serviceAppDev);

  registerAppGuestDevelopmentCommands(app, {
    appBuild,
    appCreate,
    appDoctor,
    appTest,
  });

  app
    .command("pack <app-dir>")
    .description("Pack a universal or declared platform NextClaw App artifact")
    .option("--target <target-key>", "Pack a declared platform target")
    .requiredOption(
      "--out <path>",
      "Write the .napp artifact to a specific path",
    )
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appPack.pack(target, opts));

  app
    .command("validate-publish <app-dir>")
    .description("Validate a NextClaw Mini App before Marketplace submission")
    .option("--meta <path>", "Use a custom marketplace metadata file")
    .option(
      "--artifacts <dir>",
      "Use target-keyed .napp artifacts from a directory",
    )
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appValidatePublish.validate(target, opts));

  app
    .command("publish <app-dir>")
    .description("Submit a NextClaw Mini App to the App Marketplace")
    .option("--meta <path>", "Use a custom marketplace metadata file")
    .option(
      "--artifacts <dir>",
      "Publish target-keyed .napp artifacts from a directory",
    )
    .option(
      "--allow-warnings",
      "Submit after reviewing validation warnings",
      false,
    )
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appPublish.publish(target, opts));

  app
    .command("check <app-dir>")
    .description("Check a schema v2 App package, Panel App, or Service App")
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appCheck.check(target, opts));

  app
    .command("dev <app-dir>")
    .description(
      "Start a Service App or schema v2 package and inspect its actions",
    )
    .option(
      "--component <service-id>",
      "Select a Service Component from a package",
    )
    .option("--json", "Output JSON", false)
    .option(
      "--reset-data",
      "Reset the exact development instance before starting",
      false,
    )
    .option(
      "--confirm <app-id>",
      "Confirm the Service App id when resetting data",
    )
    .action(async (target, opts) => appDev.dev(target, opts));

  const data = app
    .command("data")
    .description("Inspect and manage NextClaw App data");

  data
    .command("list")
    .description(
      "List active and retained App data through the running NextClaw host",
    )
    .option("--json", "Output JSON", false)
    .action(async (opts) => appData.list(opts));

  data
    .command("delete <data-id>")
    .description("Permanently delete a retained App data instance")
    .requiredOption("--confirm <app-id>", "Confirm the exact App id")
    .option("--json", "Output JSON", false)
    .action(async (dataId, opts) => appData.deleteRetained(dataId, opts));

  app
    .command("call <app-dir> <action-name>")
    .description(
      "Call a Service App or schema v2 package action through the real runtime",
    )
    .option(
      "--component <service-id>",
      "Select a Service Component from a package",
    )
    .option("--input <json>", "JSON object input for the action")
    .option("--json", "Output JSON", false)
    .action(async (target, actionName, opts) =>
      appCall.call(target, actionName, opts),
    );

  app
    .command("restart <app-id>")
    .description(
      "Restart a live Service App runtime in the running NextClaw UI",
    )
    .option("--json", "Output JSON", false)
    .action(async (appId, opts) => appRestart.restart(appId, opts));

  registerAppPackageCommands(app, appPackages);
}

function registerAppGuestDevelopmentCommands(
  app: Command,
  controllers: {
    appBuild: AppBuildCommandController;
    appCreate: AppCreateCommandController;
    appDoctor: AppDoctorCommandController;
    appTest: AppTestCommandController;
  },
): void {
  const { appBuild, appCreate, appDoctor, appTest } = controllers;
  app
    .command("create <app-dir>")
    .description("Create a NextClaw App from a runnable template")
    .option(
      "--template <name>",
      "Template: rust-wasi, starter, ts-http, or ts-http-lite",
      "rust-wasi",
    )
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appCreate.create(target, opts));

  app
    .command("doctor")
    .description("Check the App Guest development toolchain")
    .option(
      "--profile <profile>",
      "Toolchain profile: wasi, wasi-http, or all",
      "wasi",
    )
    .option("--json", "Output JSON", false)
    .action(async (opts) => appDoctor.doctor(opts));

  app
    .command("build <app-dir>")
    .description(
      "Build a NextClaw App Guest into its declared runtime artifact",
    )
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appBuild.build(target, opts));

  app
    .command("test <app-dir>")
    .description("Run a schema v2 App smoke fixture through the real runtime")
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appTest.test(target, opts));
}

function registerAppPackageCommands(
  app: Command,
  appPackages: AppPackageCommandController,
): void {
  const marketplace = app
    .command("marketplace")
    .description("Browse NextClaw App Marketplace");

  marketplace
    .command("search")
    .description("Search Apps in NextClaw App Marketplace")
    .option("-q, --query <text>", "Search text")
    .option("--tag <tag>", "Filter by tag")
    .option("--cursor <cursor>", "Continue from a marketplace cursor")
    .option("--limit <n>", "Maximum number of items")
    .option("--json", "Output JSON", false)
    .action(async (opts) => appPackages.searchMarketplace(opts));

  marketplace
    .command("info <selector>")
    .description("Show an App Marketplace item")
    .option("--json", "Output JSON", false)
    .action(async (selector, opts) =>
      appPackages.marketplaceInfo(selector, opts),
    );

  app
    .command("list")
    .description("List Apps installed in the running NextClaw host")
    .option("--json", "Output JSON", false)
    .action(async (opts) => appPackages.list(opts));

  app
    .command("info <app-id>")
    .description("Show an App installed in the running NextClaw host")
    .option("--json", "Output JSON", false)
    .action(async (appId, opts) => appPackages.info(appId, opts));

  app
    .command("operations")
    .description("List App install, update, rollback, and uninstall operations")
    .option("--json", "Output JSON", false)
    .action(async (opts) => appPackages.operations(opts));

  app
    .command("install <source>")
    .description("Install an App through the running NextClaw host")
    .option("--registry <url>", "Registry URL for an App id")
    .option("--json", "Output JSON", false)
    .action(async (source, opts) => appPackages.install(source, opts));

  app
    .command("enable <app-id>")
    .description("Enable an installed App")
    .option("--json", "Output JSON", false)
    .action(async (appId, opts) => appPackages.enable(appId, opts));

  app
    .command("disable <app-id>")
    .description("Disable an installed App")
    .option("--json", "Output JSON", false)
    .action(async (appId, opts) => appPackages.disable(appId, opts));

  app
    .command("update <app-id>")
    .description("Update an App through the running NextClaw host")
    .option("--version <version>", "Target version")
    .option("--registry <url>", "Registry URL")
    .option("--json", "Output JSON", false)
    .action(async (appId, opts) => appPackages.update(appId, opts));

  app
    .command("rollback <app-id>")
    .description("Roll back an App to an installed version")
    .requiredOption("--version <version>", "Installed version to activate")
    .option("--json", "Output JSON", false)
    .action(async (appId, opts) => appPackages.rollback(appId, opts));

  app
    .command("uninstall <app-id>")
    .description("Uninstall an App through the running NextClaw host")
    .option("--purge-data", "Permanently delete App data", false)
    .option("--confirm <app-id>", "Confirm the exact App id when purging data")
    .option("--json", "Output JSON", false)
    .action(async (appId, opts) => appPackages.uninstall(appId, opts));
}
