import type { Command } from "commander";
import { join } from "node:path";
import { getDataPath, loadConfig } from "@nextclaw/core";
import { FeedbackClient } from "@nextclaw-cli/cli/app/services/feedback/feedback-client.service.js";
import { registerFeedbackMaintenanceCommands } from "./feedback-maintenance-command-registration.utils.js";

type Options = { endpoint?: string; title?: string; description?: string; environment?: string; version?: string; requestId?: string; operationId?: string };
function manager(options: Options): FeedbackClient {
  const config = loadConfig();
  return new FeedbackClient({
    directory: join(getDataPath(), "feedback"),
    endpoint: options.endpoint ?? process.env.NEXTCLAW_FEEDBACK_ENDPOINT,
    platformToken: config.providers.nextclaw?.apiKey
  });
}
function print(value: unknown): void { console.log(JSON.stringify(value, null, 2)); }
export function registerFeedbackCommands(program: Command): void {
  const feedback = program.command("feedback").description("Submit and track private feedback without an external account");
  registerFeedbackMaintenanceCommands(feedback);
  const command = (name: string, description: string) => feedback.command(name).description(description).option("--endpoint <url>", "Feedback service origin");
  command("submit", "Submit a private report; receipt is saved locally")
    .requiredOption("--title <text>", "Short summary").requiredOption("--description <text>", "Problem and expected behavior")
    .option("--environment <text>", "Environment details").option("--version <version>", "Affected version")
    .option("--request-id <id>", "Retry a saved submission").action(async (o: Options) => print(await manager(o).submit({ title: o.title!, description: o.description!, environment: o.environment, version: o.version, requestId: o.requestId })));
  command("list", "List local feedback receipts").action(async (o: Options) => print(await manager(o).list()));
  command("get <id>", "Read a report and maintainer replies").action(async (id: string, o: Options) => print(await manager(o).get(id)));
  command("reply <id> <message>", "Add reproduction details or report that a fix still fails")
    .option("--operation-id <id>", "Stable operation ID for retry").action(async (id: string, message: string, o: Options) => print(await manager(o).update(id, "reply", message, o.operationId)));
  command("withdraw <id>", "Withdraw a report and stop new processing").action(async (id: string, o: Options) => print(await manager(o).update(id, "withdraw")));
  command("link <id>", "Associate a receipt with the current NextClaw account").action(async (id: string, o: Options) => print(await manager(o).update(id, "link")));
  command("sync", "Fetch feedback belonging to the current NextClaw account").action(async (o: Options) => print(await manager(o).syncAccount()));
  command("export <id> <file>", "Save a private receipt backup; keep the file secret").action(async (id: string, file: string, o: Options) => { await manager(o).exportReceipt(id, file); print({ saved: true }); });
  command("import <file>", "Restore a private receipt backup").action(async (file: string, o: Options) => print(await manager(o).importReceipt(file)));
}
