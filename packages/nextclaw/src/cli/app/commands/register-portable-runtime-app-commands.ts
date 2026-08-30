import type { Command } from "commander";
import type { AppPackageCommandController } from "@nextclaw-cli/cli/app/controllers/app-packages/app-package-command.controller.js";

export function registerPortableRuntimeAppCommands(app: Command, controller: AppPackageCommandController): void {
  app.command("verification")
    .description("Read real runtime verification records from the running host")
    .option("--acceptance <id>", "Filter by stable acceptance id")
    .option("--app <id>", "Filter by App id").option("--limit <n>", "Maximum records to return")
    .option("--json", "Output JSON", false).action(async (opts) => controller.verificationRecords(opts));

  const acceptance = app.command("acceptance")
    .description("Read the portable runtime acceptance contract and current evidence status");
  acceptance.command("contract").description("Read the stable portable runtime acceptance contract")
    .option("--locale <locale>", "Presentation locale: zh-CN or en", "zh-CN").option("--json", "Output JSON", false)
    .action(async (opts) => controller.acceptanceContract({ ...opts, locale: readAcceptanceLocale(opts.locale) }));
  acceptance.command("status").description("Read current portable runtime acceptance evidence status")
    .option("--app <id>", "Acceptance App id").option("--locale <locale>", "Presentation locale: zh-CN or en", "zh-CN")
    .option("--json", "Output JSON", false)
    .action(async (opts) => controller.acceptanceStatus({ ...opts, locale: readAcceptanceLocale(opts.locale) }));
  acceptance.command("export").description("Export the portable runtime acceptance contract, identity, and evidence status as JSON")
    .option("--app <id>", "Acceptance App id").option("--locale <locale>", "Presentation locale: zh-CN or en", "zh-CN")
    .option("--json", "Output JSON", false)
    .action(async (opts) => controller.acceptanceExport({ ...opts, locale: readAcceptanceLocale(opts.locale) }));

  registerAiCommands(app, controller);
  registerJobCommands(app, controller);
  registerResidentCommands(app, controller);
}

function registerAiCommands(app: Command, controller: AppPackageCommandController): void {
  const ai = app.command("ai-capabilities").description("Inspect and bind non-secret model and Agent slots for a Service App");
  ai.command("inspect <app-id>").option("--json", "Output JSON", false).action(async (id, opts) => controller.inspectAiCapabilities(id, opts));
  ai.command("verify <app-id>").option("--json", "Output JSON", false).action(async (id, opts) => controller.verifyAiCapabilities(id, opts));
  ai.command("bind <app-id>").requiredOption("--kind <kind>", "Slot kind: model or agent")
    .requiredOption("--slot <id>", "Declared slot id").requiredOption("--target <id>", "Configured model or Agent id")
    .option("--json", "Output JSON", false).action(async (id, opts) => controller.bindAiCapability(id, opts));
  ai.command("unbind <app-id>").requiredOption("--kind <kind>", "Slot kind: model or agent")
    .requiredOption("--slot <id>", "Declared slot id").option("--json", "Output JSON", false)
    .action(async (id, opts) => controller.unbindAiCapability(id, opts));
}

function registerJobCommands(app: Command, controller: AppPackageCommandController): void {
  const jobs = app.command("jobs").description("Inspect, replay, and cancel durable App Jobs through the running host");
  jobs.command("list <app-id>").description("List durable Jobs for one installed App instance")
    .option("--json", "Output JSON", false).action(async (id, opts) => controller.listJobs(id, opts));
  jobs.command("inspect <app-id> <job-id>").description("Inspect one durable App Job")
    .option("--json", "Output JSON", false).action(async (id, jobId, opts) => controller.inspectJob(id, jobId, opts));
  jobs.command("watch <app-id> <job-id>").description("Replay retained Job progress and stream output from a cursor")
    .option("--after <sequence>", "Replay only events after this sequence").option("--json", "Output JSON", false)
    .action(async (id, jobId, opts) => controller.watchJob(id, jobId, opts));
  jobs.command("cancel <app-id> <job-id>").description("Request cancellation; the Job remains pending until the runner confirms it")
    .option("--json", "Output JSON", false).action(async (id, jobId, opts) => controller.cancelJob(id, jobId, opts));
}

function registerResidentCommands(app: Command, controller: AppPackageCommandController): void {
  const inbox = app.command("resident-inbox").description("Inspect and replay durable Resident events through the running host");
  inbox.command("list <app-id>").description("List retained Resident event delivery state")
    .option("--dead-letters", "Show only dead-letter events", false).option("--json", "Output JSON", false)
    .action(async (id, opts) => controller.listResidentInbox(id, opts));
  inbox.command("replay <app-id> <event-id>").description("Replay one dead-letter Resident event through the durable inbox")
    .option("--json", "Output JSON", false).action(async (id, eventId, opts) => controller.replayResidentDeadLetter(id, eventId, opts));
}

function readAcceptanceLocale(value: unknown): "zh-CN" | "en" {
  if (value === "zh-CN" || value === "en") return value;
  throw new Error("--locale must be zh-CN or en.");
}
