import { InvalidArgumentError, type Command } from "commander";
import type { DoctorController } from "@/controllers/doctor.controller.js";
import type { ImageController } from "@/controllers/image.controller.js";
import type { ModelsController } from "@/controllers/models.controller.js";
import type { ProvidersController } from "@/controllers/providers.controller.js";
import type { SecretsController } from "@/controllers/secrets.controller.js";
import type { AigenCommandOutput } from "@/types/cli-output.types.js";

export type AigenCommandOutputSink = (output: AigenCommandOutput) => void;

export type AigenCommandControllers = {
  imageController: ImageController;
  providersController: ProvidersController;
  modelsController: ModelsController;
  secretsController: SecretsController;
  doctorController: DoctorController;
};

export const registerAigenCommands = (
  program: Command,
  controllers: AigenCommandControllers,
  sink: AigenCommandOutputSink,
): void => {
  registerImageCommand(program, controllers, sink);
  registerProvidersCommands(program, controllers, sink);
  registerModelsCommands(program, controllers, sink);
  registerSecretsCommands(program, controllers, sink);
  registerDoctorCommand(program, controllers, sink);
};

const registerImageCommand = (
  program: Command,
  controllers: AigenCommandControllers,
  sink: AigenCommandOutputSink,
): void => {
  withOutputOptions(
    program
      .command("image")
      .description("Generate an image")
      .requiredOption(
        "--model <route>",
        "Model route in <provider-id>/<provider-local-model> format",
      )
      .requiredOption("--prompt <text>", "Generation prompt")
      .option("--size <size>", "Image size")
      .option(
        "--n <count>",
        "Number of images to generate",
        parseNumberOption,
        1,
      )
      .option("--quality <quality>", "Image quality")
      .option("--background <background>", "Background mode")
      .option("--output-format <format>", "Output format")
      .option(
        "--output-compression <value>",
        "Output compression",
        parseNumberOption,
      )
      .option("--moderation <mode>", "Moderation mode")
      .requiredOption("--output-dir <dir>", "Directory for generated assets")
      .requiredOption("--output-name <name>", "Base output file name"),
  ).action(async (options) => {
    sink(await controllers.imageController.generate(options));
  });
};

const registerProvidersCommands = (
  program: Command,
  controllers: AigenCommandControllers,
  sink: AigenCommandOutputSink,
): void => {
  const providers = program
    .command("providers")
    .description("Manage image generation providers");

  withOutputOptions(
    providers.command("list").description("List configured providers"),
  ).action(async () => {
    sink(await controllers.providersController.list());
  });

  withOutputOptions(
    providers
      .command("get <providerId>")
      .description("Get a configured provider"),
  ).action(async (providerId) => {
    sink(await controllers.providersController.get(providerId));
  });

  withOutputOptions(
    providers
      .command("add <providerId>")
      .description("Add a provider")
      .requiredOption(
        "--api-format <format>",
        "Provider API format, for example openrouter or openai",
      )
      .option("--display-name <name>", "Provider display name")
      .option("--api-base <url>", "Provider API base URL"),
  ).action(async (providerId, options) => {
    sink(await controllers.providersController.add(providerId, options));
  });

  withOutputOptions(
    providers
      .command("update <providerId>")
      .description("Update a provider")
      .option("--api-format <format>", "Provider API format")
      .option("--display-name <name>", "Provider display name")
      .option("--api-base <url>", "Provider API base URL"),
  ).action(async (providerId, options) => {
    sink(await controllers.providersController.update(providerId, options));
  });

  withOutputOptions(
    providers.command("remove <providerId>").description("Remove a provider"),
  ).action(async (providerId) => {
    sink(await controllers.providersController.remove(providerId));
  });
};

const registerModelsCommands = (
  program: Command,
  controllers: AigenCommandControllers,
  sink: AigenCommandOutputSink,
): void => {
  const models = program
    .command("models")
    .description("Manage provider models");

  withOutputOptions(
    models
      .command("list")
      .description(
        "List configured models, or remote provider models with --remote",
      )
      .option("--remote", "List remote models from a provider", false)
      .option("--provider <providerId>", "Provider id")
      .option("--kind <kind>", "Model kind"),
  ).action(async (options) => {
    sink(await controllers.modelsController.list(options));
  });

  withOutputOptions(
    models.command("get <modelRoute>").description("Get a configured model"),
  ).action(async (modelRoute) => {
    sink(await controllers.modelsController.get(modelRoute));
  });

  withOutputOptions(
    models
      .command("add <modelRoute>")
      .description("Add a model under a provider")
      .option("--kind <kind>", "Model kind", "image")
      .option("--display-name <name>", "Model display name")
      .option("--generate", "Mark model as generation-capable", false)
      .option("--edit", "Mark model as edit-capable", false)
      .option(
        "--max-count <count>",
        "Maximum generated asset count",
        parseNumberOption,
      ),
  ).action(async (modelRoute, options) => {
    sink(await controllers.modelsController.add(modelRoute, options));
  });

  withOutputOptions(
    models
      .command("update <modelRoute>")
      .description("Update a model")
      .option("--kind <kind>", "Model kind")
      .option("--display-name <name>", "Model display name")
      .option("--generate", "Mark model as generation-capable")
      .option("--edit", "Mark model as edit-capable")
      .option(
        "--max-count <count>",
        "Maximum generated asset count",
        parseNumberOption,
      ),
  ).action(async (modelRoute, options) => {
    sink(await controllers.modelsController.update(modelRoute, options));
  });

  withOutputOptions(
    models.command("remove <modelRoute>").description("Remove a model"),
  ).action(async (modelRoute) => {
    sink(await controllers.modelsController.remove(modelRoute));
  });
};

const registerSecretsCommands = (
  program: Command,
  controllers: AigenCommandControllers,
  sink: AigenCommandOutputSink,
): void => {
  const secrets = program
    .command("secrets")
    .description("Manage provider API keys");

  withOutputOptions(
    secrets.command("list").description("List masked provider secrets"),
  ).action(async () => {
    sink(await controllers.secretsController.list());
  });

  withOutputOptions(
    secrets
      .command("get <providerId>")
      .description("Get masked provider secret metadata"),
  ).action(async (providerId) => {
    sink(await controllers.secretsController.get(providerId));
  });

  withOutputOptions(
    secrets
      .command("set <providerId>")
      .description("Set provider API key from stdin")
      .option("--stdin", "Read provider API key from stdin", false),
  ).action(async (providerId) => {
    sink(await controllers.secretsController.set(providerId));
  });

  withOutputOptions(
    secrets
      .command("remove <providerId>")
      .description("Remove provider API key"),
  ).action(async (providerId) => {
    sink(await controllers.secretsController.remove(providerId));
  });
};

const registerDoctorCommand = (
  program: Command,
  controllers: AigenCommandControllers,
  sink: AigenCommandOutputSink,
): void => {
  withOutputOptions(
    program
      .command("doctor")
      .description("Run local configuration diagnostics")
      .option("--provider <providerId>", "Provider id to check")
      .option("--model <modelRoute>", "Model route to check"),
  ).action(async (options) => {
    sink(await controllers.doctorController.run(options));
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
