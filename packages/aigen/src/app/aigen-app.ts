import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";
import { DoctorController } from "@/controllers/doctor.controller.js";
import { ImageController } from "@/controllers/image.controller.js";
import { ModelsController } from "@/controllers/models.controller.js";
import { ProvidersController } from "@/controllers/providers.controller.js";
import { SecretsController } from "@/controllers/secrets.controller.js";
import {
  registerAigenCommands,
  type AigenCommandOutputSink,
} from "@/app/register-aigen-commands.js";
import { ImageGenerationManager } from "@/managers/image-generation.manager.js";
import { OutputFileManager } from "@/managers/output-file.manager.js";
import { ProviderRuntimeManager } from "@/managers/provider-runtime.manager.js";
import { OpenRouterProvider } from "@/providers/openrouter.provider.js";
import { ConfigRepository } from "@/repositories/config.repository.js";
import { SecretsRepository } from "@/repositories/secrets.repository.js";
import {
  AigenError,
  type AigenCommandOutput,
} from "@/types/cli-output.types.js";
import { toCommandFailure } from "@/utils/error.utils.js";

export class AigenApp {
  constructor(
    private readonly imageController: ImageController,
    private readonly providersController: ProvidersController,
    private readonly modelsController: ModelsController,
    private readonly secretsController: SecretsController,
    private readonly doctorController: DoctorController,
    private readonly version = resolveAigenPackageVersion(),
  ) {}

  run = async (argv: string[]): Promise<AigenCommandOutput> => {
    let commandOutput: AigenCommandOutput | undefined;
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
        throw new AigenError("INVALID_ARGUMENT", "Missing command.");
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

  private createProgram = (sink: AigenCommandOutputSink): Command => {
    const program = new Command();
    program
      .name("aigen")
      .description("Stateless AI media generation CLI.")
      .version(this.version, "-v, --version");
    program.exitOverride();
    program.showHelpAfterError();

    registerAigenCommands(
      program,
      {
        imageController: this.imageController,
        providersController: this.providersController,
        modelsController: this.modelsController,
        secretsController: this.secretsController,
        doctorController: this.doctorController,
      },
      sink,
    );

    return program;
  };

  private commanderFailure = (
    error: CommanderError,
    capturedOutput: string,
    capturedError: string,
  ): AigenCommandOutput => {
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
        retryable: false,
      },
    };
  };
}

export const createAigenApp = (homeDir?: string): AigenApp => {
  const configRepository = new ConfigRepository(homeDir);
  const secretsRepository = new SecretsRepository(homeDir);
  const providerRuntimeManager = new ProviderRuntimeManager([
    new OpenRouterProvider(),
  ]);
  const outputFileManager = new OutputFileManager();
  const imageGenerationManager = new ImageGenerationManager(
    configRepository,
    secretsRepository,
    providerRuntimeManager,
    outputFileManager,
  );

  return new AigenApp(
    new ImageController(imageGenerationManager),
    new ProvidersController(configRepository),
    new ModelsController(
      configRepository,
      secretsRepository,
      providerRuntimeManager,
    ),
    new SecretsController(secretsRepository),
    new DoctorController(
      configRepository,
      secretsRepository,
      providerRuntimeManager,
    ),
  );
};

const resolveAigenPackageVersion = (): string => {
  const packageJsonUrl = new URL("../../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as {
    version?: unknown;
  };

  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
};
