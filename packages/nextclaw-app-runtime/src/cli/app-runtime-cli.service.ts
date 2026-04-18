import packageJson from "../../package.json" with { type: "json" };
import { CreateCommand } from "../commands/create.controller.js";
import { DevCommand } from "../commands/dev.controller.js";
import { GrantCommand } from "../commands/grant.controller.js";
import { InfoCommand } from "../commands/info.controller.js";
import { InspectCommand } from "../commands/inspect.controller.js";
import { InstallCommand } from "../commands/install.controller.js";
import { ListCommand } from "../commands/list.controller.js";
import { PackCommand } from "../commands/pack.controller.js";
import { PermissionsCommand } from "../commands/permissions.controller.js";
import { RegistryCommand } from "../commands/registry.controller.js";
import { RevokeCommand } from "../commands/revoke.controller.js";
import { RunCommand } from "../commands/run.controller.js";
import { UninstallCommand } from "../commands/uninstall.controller.js";
import { UpdateCommand } from "../commands/update.controller.js";
import { AppRuntimeOptionsService } from "./app-runtime-options.service.js";

export class AppRuntimeCliService {
  constructor(
    private readonly optionsService: AppRuntimeOptionsService = new AppRuntimeOptionsService(),
  ) {}

  run = async (): Promise<void> => {
    const args = process.argv.slice(2);
    const [command, ...restArgs] = args;
    if (command === "--help" || command === "help") {
      this.writeUsage();
      return;
    }
    if (command === "--version" || command === "version") {
      this.write(`${packageJson.version}\n`);
      return;
    }
    if (!command) {
      this.writeUsage();
      process.exit(1);
    }
    await this.dispatch(command, restArgs);
  };

  private dispatch = async (command: string, restArgs: string[]): Promise<void> => {
    switch (command) {
      case "create":
        await this.handleCreate(restArgs);
        return;
      case "inspect":
        await this.handleInspect(restArgs);
        return;
      case "run":
        await this.handleRun(restArgs);
        return;
      case "dev":
        await this.handleDev(restArgs);
        return;
      case "pack":
        await this.handlePack(restArgs);
        return;
      case "install":
        await this.handleInstall(restArgs);
        return;
      case "update":
        await this.handleUpdate(restArgs);
        return;
      case "uninstall":
        await this.handleUninstall(restArgs);
        return;
      case "list":
        await this.handleList(restArgs);
        return;
      case "info":
        await this.handleInfo(restArgs);
        return;
      case "registry":
        await this.handleRegistry(restArgs);
        return;
      case "permissions":
        await this.handlePermissions(restArgs);
        return;
      case "grant":
        await this.handleGrant(restArgs);
        return;
      case "revoke":
        await this.handleRevoke(restArgs);
        return;
      default:
        this.writeUsage();
        process.exit(1);
    }
  };

  private handleCreate = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("create", restArgs);
    const options = this.optionsService.readCreateOptions(optionArgs);
    await new CreateCommand().run({
      appDirectory: target,
      json: options.json,
      write: this.write,
    });
  };

  private handleInspect = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("inspect", restArgs);
    const options = this.optionsService.readJsonOnlyOptions(optionArgs);
    await new InspectCommand().run({
      appDirectory: target,
      json: options.json,
      write: this.write,
    });
  };

  private handleRun = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("run", restArgs);
    const options = this.optionsService.readRuntimeOptions(optionArgs);
    await new RunCommand().run({
      appReference: target,
      host: options.host,
      port: options.port,
      json: options.json,
      documentGrantMap: options.documentGrantMap,
      write: this.write,
    });
  };

  private handleDev = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("dev", restArgs);
    const options = this.optionsService.readRuntimeOptions(optionArgs);
    await new DevCommand().run({
      appReference: target,
      host: options.host,
      port: options.port,
      json: options.json,
      documentGrantMap: options.documentGrantMap,
      write: this.write,
    });
  };

  private handlePack = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("pack", restArgs);
    const options = this.optionsService.readPackOptions(optionArgs);
    await new PackCommand().run({
      appDirectory: target,
      outputPath: options.outputPath,
      json: options.json,
      write: this.write,
    });
  };

  private handleInstall = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("install", restArgs);
    const options = this.optionsService.readInstallOptions(optionArgs);
    await new InstallCommand().run({
      appSource: target,
      registryUrl: options.registryUrl,
      json: options.json,
      write: this.write,
    });
  };

  private handleUpdate = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("update", restArgs);
    const options = this.optionsService.readUpdateOptions(optionArgs);
    await new UpdateCommand().run({
      appId: target,
      version: options.version,
      registryUrl: options.registryUrl,
      json: options.json,
      write: this.write,
    });
  };

  private handleUninstall = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("uninstall", restArgs);
    const options = this.optionsService.readUninstallOptions(optionArgs);
    await new UninstallCommand().run({
      appId: target,
      purgeData: options.purgeData,
      json: options.json,
      write: this.write,
    });
  };

  private handleList = async (restArgs: string[]): Promise<void> => {
    const options = this.optionsService.readJsonOnlyOptions(restArgs);
    await new ListCommand().run({
      json: options.json,
      write: this.write,
    });
  };

  private handleInfo = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("info", restArgs);
    const options = this.optionsService.readJsonOnlyOptions(optionArgs);
    await new InfoCommand().run({
      appId: target,
      json: options.json,
      write: this.write,
    });
  };

  private handleRegistry = async (restArgs: string[]): Promise<void> => {
    const [actionOrUrl, ...optionArgs] = restArgs;
    if (!actionOrUrl || actionOrUrl === "get") {
      const options = this.optionsService.readJsonOnlyOptions(optionArgs);
      await new RegistryCommand().run({
        action: "get",
        json: options.json,
        write: this.write,
      });
      return;
    }
    if (actionOrUrl === "--json") {
      const options = this.optionsService.readJsonOnlyOptions([actionOrUrl, ...optionArgs]);
      await new RegistryCommand().run({
        action: "get",
        json: options.json,
        write: this.write,
      });
      return;
    }
    if (actionOrUrl === "set") {
      const { target, optionArgs: actionOptionArgs } = this.optionsService.readTarget(
        "registry set",
        optionArgs,
      );
      const options = this.optionsService.readJsonOnlyOptions(actionOptionArgs);
      await new RegistryCommand().run({
        action: "set",
        registryUrl: target,
        json: options.json,
        write: this.write,
      });
      return;
    }
    if (actionOrUrl === "reset") {
      const options = this.optionsService.readJsonOnlyOptions(optionArgs);
      await new RegistryCommand().run({
        action: "reset",
        json: options.json,
        write: this.write,
      });
      return;
    }
    throw new Error(`未知 registry 子命令：${actionOrUrl}`);
  };

  private handlePermissions = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("permissions", restArgs);
    const options = this.optionsService.readJsonOnlyOptions(optionArgs);
    await new PermissionsCommand().run({
      appId: target,
      json: options.json,
      write: this.write,
    });
  };

  private handleGrant = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("grant", restArgs);
    const options = this.optionsService.readGrantOptions(optionArgs);
    await new GrantCommand().run({
      appId: target,
      documentGrantMap: options.documentGrantMap,
      json: options.json,
      write: this.write,
    });
  };

  private handleRevoke = async (restArgs: string[]): Promise<void> => {
    const { target, optionArgs } = this.optionsService.readTarget("revoke", restArgs);
    const options = this.optionsService.readRevokeOptions(optionArgs);
    await new RevokeCommand().run({
      appId: target,
      documentScopeIds: options.documentScopeIds,
      json: options.json,
      write: this.write,
    });
  };

  private writeUsage = (): void => {
    this.write("Usage: napp create <app-dir> [--json]\n");
    this.write("       napp inspect <app-dir> [--json]\n");
    this.write("       napp <run|dev> <app-dir|app-id> [--host 127.0.0.1] [--port 3100] [--json] [--document scope=/path]\n");
    this.write("       napp pack <app-dir> [--out bundle.napp] [--json]\n");
    this.write("       napp install <app-dir|bundle.napp|app-id[@version]> [--registry <url>] [--json]\n");
    this.write("       napp update <app-id> [--version <version>] [--registry <url>] [--json]\n");
    this.write("       napp uninstall <app-id> [--purge-data] [--json]\n");
    this.write("       napp list [--json]\n");
    this.write("       napp info <app-id> [--json]\n");
    this.write("       napp registry [get] [--json]\n");
    this.write("       napp registry set <url> [--json]\n");
    this.write("       napp registry reset [--json]\n");
    this.write("       napp permissions <app-id> [--json]\n");
    this.write("       napp grant <app-id> --document scope=/path [--json]\n");
    this.write("       napp revoke <app-id> --document scope [--json]\n");
    this.write("       napp --help\n");
    this.write("       napp --version\n");
  };

  private write = (text: string): void => {
    process.stdout.write(text);
  };
}
