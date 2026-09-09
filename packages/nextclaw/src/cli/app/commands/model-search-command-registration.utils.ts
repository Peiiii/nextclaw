import { Argument, InvalidArgumentError, Option, type Command } from "commander";
import { ModelSearchCommandController } from "@nextclaw-cli/cli/app/controllers/config/model-search-command.controller.js";
import { parseConfigBoolean } from "@nextclaw-cli/cli/app/utils/config-command-options.utils.js";

const searchProviders = ["bocha", "tavily", "brave", "exa"];

export function registerModelSearchCommands(program: Command, controller = new ModelSearchCommandController()): void {
  const output = (command: Command): Command => command.option("--json", "Output JSON (also the default)");
  const models = program.command("models").description("Inspect available models and manage the default model");
  output(models.command("list").description("Show the runtime model catalog and discovery status")).action(controller.listModels);
  output(models.command("show").description("Show the default model")).action(controller.showModel);
  output(models.command("set <model>").description("Set the default model using a provider-scoped model id")).action(controller.setModel);

  const search = program.command("search").description("Manage web search settings through the running host");
  output(search.command("show").description("Show search settings without exposing credentials")).action(controller.showSearch);
  output(search.command("configure").description("Configure default search provider, enabled providers and result count")
    .addOption(new Option("--provider <provider>", "Default search provider").choices(searchProviders))
    .addOption(new Option("--enabled-provider <providers...>", "Replace enabled search providers").choices(searchProviders))
    .option("--clear-enabled-providers", "Disable all search providers")
    .option("--max-results <count>", "Default result count (1-50)", parseResultCount)).action(controller.configureSearch);
  output(search.command("provider").description("Update one search provider's credentials and supported options")
    .addArgument(new Argument("<provider>").choices(searchProviders))
    .option("--api-key-env <name>", "Read the API key from an environment variable")
    .option("--clear-api-key", "Clear the stored API key and its secret reference")
    .option("--base-url <url>", "Search API base URL; empty string resets it")
    .option("--docs-url <url>", "Bocha documentation URL")
    .option("--summary <boolean>", "Bocha summary", parseConfigBoolean)
    .option("--freshness <value>", "Bocha freshness")
    .addOption(new Option("--search-depth <depth>", "Tavily search depth").choices(["basic", "advanced"]))
    .option("--include-answer <boolean>", "Tavily synthesized answer", parseConfigBoolean)).action(controller.configureSearchProvider);
}

function parseResultCount(value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new InvalidArgumentError("Expected an integer from 1 to 50.");
  return count;
}
