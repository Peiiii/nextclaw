import { Option, type Command } from "commander";
import { ProviderCommandController } from "@nextclaw-cli/cli/app/controllers/config/provider-command.controller.js";
import { collectConfigOption } from "@nextclaw-cli/cli/app/utils/config-command-options.utils.js";

export function registerProviderCommands(program: Command, controller = new ProviderCommandController()): void {
  const providers = program.command("providers").description("Manage model providers through the running NextClaw host");
  const output = (command: Command): Command => command.option("--json", "Output JSON (also the default)");
  output(providers.command("list").description("List providers without exposing credentials")).action(controller.list);
  output(providers.command("templates").description("List provider templates and authorization methods")).action(controller.templates);
  output(providers.command("show <provider-id>").description("Show one provider")).action(controller.show);
  output(providerOptions(providers.command("add <provider-id>").description("Create a provider instance"))).action(controller.add);
  output(providerOptions(providers.command("update <provider-id>").description("Update specified provider settings"))).action(controller.update);
  output(providers.command("remove <provider-id>").description("Remove a provider and its secret references")).action(controller.remove);
  output(providers.command("enable <provider-id>").description("Enable a provider")).action(async (id) => controller.enabled(id, true));
  output(providers.command("disable <provider-id>").description("Disable a provider")).action(async (id) => controller.enabled(id, false));
  output(providers.command("test <provider-id>").description("Test a provider connection; failure exits non-zero")
    .option("--model <model>", "Model to test")).action(controller.test);

  const models = providers.command("models").description("Manage a provider's models");
  output(models.command("list <provider-id>").description("Show configured models and capability overrides")).action(controller.models);
  output(models.command("discover <provider-id>").description("Discover available models without changing configuration")).action(controller.discover);
  output(models.command("set <provider-id> [models...]").description("Replace the configured model list; omit models to clear it"))
    .action(controller.setModels);
  output(models.command("configure <provider-id>").description("Replace all model capability overrides (model list is unchanged)")
    .option("--vision <model=true|false>", "Vision capability (repeatable)", collectConfigOption)
    .option("--thinking <model=levels>", "Comma-separated supported thinking levels (repeatable)", collectConfigOption)
    .option("--thinking-default <model=level>", "Default thinking level (repeatable)", collectConfigOption)
    .option("--clear", "Clear all model capability overrides")).action(controller.configureModels);

  const auth = providers.command("auth").description("Authorize a provider");
  output(auth.command("start <provider-id>").description("Start authorization; returns verification URI, user code and session id")
    .option("--method <id>", "Authorization method from providers templates")).action(controller.startAuth);
  output(auth.command("poll <provider-id> <session-id>").description("Poll once; respect the returned nextPollMs before polling again"))
    .action(controller.pollAuth);
  output(auth.command("import <provider-id>").description("Import credentials from a supported provider CLI")).action(controller.importAuth);
}

function providerOptions(command: Command): Command {
  return command
    .option("--type <type>", "Template type from providers templates, or custom")
    .option("--name <name>", "Display name")
    .option("--api-base <url>", "API base URL; empty string resets it")
    .option("--api-key-env <name>", "Read the API key from an environment variable")
    .option("--clear-api-key", "Clear the stored API key and its secret reference")
    .addOption(new Option("--wire-api <protocol>", "API protocol").choices(["auto", "chat", "responses"]))
    .option("--header <name=value>", "Replace custom headers with the supplied entries (repeatable)", collectConfigOption)
    .option("--clear-headers", "Clear custom headers");
}
