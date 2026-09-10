import type { Command } from "commander";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  FeedbackCodexDesktopService,
  feedbackCodexTriggerInputFromEnvironment,
} from "@nextclaw-cli/cli/app/services/feedback/feedback-codex-desktop.service.js";
import { FeedbackMaintenanceClient } from "@nextclaw-cli/cli/app/services/feedback/feedback-maintenance-client.service.js";
import { FeedbackMaintenanceSupervisorService } from "@nextclaw-cli/cli/app/services/feedback/feedback-maintenance-supervisor.service.js";
import { FeedbackMaintenanceWorkerService } from "@nextclaw-cli/cli/app/services/feedback/feedback-maintenance-worker.service.js";
import {
  FeedbackMaintenanceStateStore,
  type FeedbackMaintainerConfig,
} from "@nextclaw-cli/cli/app/stores/feedback/feedback-maintenance-state.store.js";

type LifecycleOptions = {
  endpoint?: string;
  tokenFile?: string;
  workspace?: string;
  interval?: string;
  timeout?: string;
  preset?: string;
};

export function registerFeedbackMaintenanceLifecycleCommands(
  group: Command,
  skillPath: () => Promise<string>
): void {
  const lifecycleOptions = (target: Command) =>
    target
      .option("--endpoint <url>", "Feedback service origin")
      .option("--token-file <path>", "Private maintainer token file")
      .option(
        "--workspace <path>",
        "Codex Desktop preset workspace; not part of the trigger protocol"
      )
      .option(
        "--interval <milliseconds>",
        "Polling interval; defaults to 30000"
      )
      .option("--timeout <milliseconds>", "Trigger timeout; defaults to 600000")
      .option("--preset <name>", "Recommended trigger preset: codex-desktop");
  lifecycleOptions(
    group
      .command("configure [command...]", { hidden: false })
      .description(
        "Save the maintainer listener configuration; pass a trigger argv after --"
      )
  ).action(async (commandArgs: string[], options: LifecycleOptions) => {
    const { preset, workspace } = options;
    const config = await writeFeedbackMaintainerConfig(
      options,
      commandArgs ?? []
    );
    if (preset === "codex-desktop")
      await new FeedbackCodexDesktopService().check();
    console.log(
      JSON.stringify(
        feedbackMaintainerConfigOutput(config, preset, workspace),
        null,
        2
      )
    );
  });
  lifecycleOptions(
    group
      .command("start [command...]", { hidden: false })
      .description("Start the configured feedback listener in the background")
  ).action(async (commandArgs: string[], options: LifecycleOptions) => {
    const store = new FeedbackMaintenanceStateStore();
    const hasOverrides = Boolean(
      (commandArgs?.length ?? 0) || Object.values(options).some(Boolean)
    );
    if (hasOverrides)
      await writeFeedbackMaintainerConfig(options, commandArgs ?? [], store);
    else await store.readConfig();
    console.log(
      JSON.stringify(
        await new FeedbackMaintenanceSupervisorService(store).start(),
        null,
        2
      )
    );
  });
  group
    .command("status")
    .description("Show listener health and the last trigger error")
    .action(async () =>
      console.log(
        JSON.stringify(
          await new FeedbackMaintenanceSupervisorService().status(),
          null,
          2
        )
      )
    );
  group
    .command("stop")
    .description("Stop the configured feedback listener")
    .action(async () =>
      console.log(
        JSON.stringify(
          await new FeedbackMaintenanceSupervisorService().stop(),
          null,
          2
        )
      )
    );
  group
    .command("restart")
    .description("Restart the configured feedback listener")
    .action(async () => {
      const store = new FeedbackMaintenanceStateStore();
      console.log(
        JSON.stringify(
          await new FeedbackMaintenanceSupervisorService(store).restart(),
          null,
          2
        )
      );
    });
  group.command("worker", { hidden: true }).action(async () => {
    const store = new FeedbackMaintenanceStateStore();
    const config = await store.readConfig();
    const instanceId = process.env.NEXTCLAW_FEEDBACK_MAINTAINER_INSTANCE_ID;
    if (!instanceId)
      throw new Error(
        "Feedback worker must be started through `feedback maintain start`."
      );
    const deadline = Date.now() + 5_000;
    let runtime = await store.readRuntime();
    while (runtime?.instanceId !== instanceId && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
      runtime = await store.readRuntime();
    }
    if (runtime?.instanceId !== instanceId || runtime.pid !== process.pid)
      throw new Error("Feedback worker runtime ownership was not established.");
    const token = (await readFile(config.tokenFile, "utf8")).trim();
    const worker = new FeedbackMaintenanceWorkerService({
      client: new FeedbackMaintenanceClient({
        endpoint: config.endpoint,
        token,
      }),
      config,
      command: config.command,
      skillPath: await skillPath(),
      store,
    });
    await worker.watch();
  });
  group
    .command("codex-desktop-trigger", { hidden: true })
    .requiredOption(
      "--workspace <path>",
      "Workspace used by this Codex consumer"
    )
    .action(async (options: LifecycleOptions) => {
      const workspace = await resolveExistingDirectory(
        options.workspace,
        "--workspace"
      );
      console.log(
        JSON.stringify(
          await new FeedbackCodexDesktopService().trigger(
            feedbackCodexTriggerInputFromEnvironment(workspace)
          ),
          null,
          2
        )
      );
    });
}

function feedbackMaintainerConfigOutput(
  config: FeedbackMaintainerConfig,
  preset?: string,
  workspace?: string
): Record<string, unknown> {
  if (preset !== "codex-desktop") return { configured: true, ...config };
  const { command: _command, ...visible } = config;
  return {
    configured: true,
    ...visible,
    preset,
    workspace: resolve(workspace ?? process.cwd()),
  };
}

async function writeFeedbackMaintainerConfig(
  options: LifecycleOptions,
  commandArgs: string[],
  store = new FeedbackMaintenanceStateStore()
): Promise<FeedbackMaintainerConfig> {
  const previous = await store.readConfig().catch(() => null);
  const {
    endpoint,
    tokenFile,
    workspace,
    interval,
    timeout,
    preset: requestedPreset,
  } = options;
  const intervalMs =
    interval === undefined ? previous?.intervalMs : Number(interval);
  const timeoutMs =
    timeout === undefined ? previous?.timeoutMs : Number(timeout);
  if (requestedPreset && requestedPreset !== "codex-desktop")
    throw new Error("Unknown feedback trigger preset.");
  if (requestedPreset && commandArgs.length)
    throw new Error("Choose either a trigger command or a preset.");
  if (workspace && !requestedPreset)
    throw new Error("--workspace is only valid with --preset codex-desktop.");
  const triggerCommand = requestedPreset
    ? codexDesktopTriggerCommand(
        await resolveExistingDirectory(
          workspace ?? process.cwd(),
          "--workspace"
        )
      )
    : commandArgs.length
    ? commandArgs
    : previous?.command ?? [];
  return store.writeConfig({
    endpoint: endpoint ?? previous?.endpoint ?? "https://roadmap.nextclaw.io",
    tokenFile: resolveRequiredPath(
      tokenFile ?? previous?.tokenFile,
      "--token-file"
    ),
    intervalMs,
    timeoutMs,
    command: triggerCommand,
  });
}

function resolveRequiredPath(path: string | undefined, option: string): string {
  if (!path) throw new Error(`${option} is required.`);
  return resolve(path);
}

async function resolveExistingDirectory(
  path: string | undefined,
  option: string
): Promise<string> {
  const resolved = resolveRequiredPath(path, option);
  if (!(await stat(resolved)).isDirectory())
    throw new Error(`${option} must reference an existing directory.`);
  return resolved;
}

function codexDesktopTriggerCommand(workspace: string): string[] {
  if (!process.argv[1]) throw new Error("Unable to locate the NextClaw CLI.");
  return [
    process.execPath,
    process.argv[1],
    "feedback",
    "maintain",
    "codex-desktop-trigger",
    "--workspace",
    workspace,
  ];
}
