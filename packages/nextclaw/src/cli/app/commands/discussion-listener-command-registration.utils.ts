import type { Command } from "commander";
import { open, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  CodexDesktopDiscussionConsumerService,
  discussionCodexTriggerInputFromEnvironment,
} from "@nextclaw-cli/cli/app/services/discussion/codex-desktop-discussion-consumer.service.js";
import { DiscussionListenerSupervisorService } from "@nextclaw-cli/cli/app/services/discussion/discussion-listener-supervisor.service.js";
import { DiscussionListenerWorkerService } from "@nextclaw-cli/cli/app/services/discussion/discussion-listener-worker.service.js";
import { DiscussionClient } from "@nextclaw-cli/cli/app/services/discussion/discussion-client.service.js";
import {
  DiscussionListenerStateStore,
  type DiscussionListenerConfig,
} from "@nextclaw-cli/cli/app/stores/discussion/discussion-listener-state.store.js";

type LifecycleOptions = {
  endpoint?: string;
  tokenFile?: string;
  workspace?: string;
  interval?: string;
  timeout?: string;
  preset?: string;
};

export function registerDiscussionListenerCommands(
  group: Command,
  skillPath: () => Promise<string>
): void {
  const lifecycleOptions = (target: Command) =>
    target
      .option("--endpoint <url>", "Discussion service origin")
      .option("--token-file <path>", "Private participant token file")
      .option(
        "--workspace <path>",
        "Codex Desktop preset workspace; not part of the trigger protocol"
      )
      .option(
        "--interval <milliseconds>",
        "Polling interval; defaults to 30000"
      )
      .option("--timeout <milliseconds>", "Trigger handshake timeout; defaults to 60000")
      .option("--preset <name>", "Recommended trigger preset: codex-desktop");
  lifecycleOptions(
    group
      .command("configure [command...]", { hidden: false })
      .description(
        "Save the discussion listener configuration; pass a trigger argv after --"
      )
  ).action(async (commandArgs: string[], options: LifecycleOptions) => {
    const { preset, workspace } = options;
    const config = await writeDiscussionListenerConfig(
      options,
      commandArgs ?? []
    );
    if (preset === "codex-desktop")
      await new CodexDesktopDiscussionConsumerService().check();
    console.log(
      JSON.stringify(
        discussionListenerConfigOutput(config, preset, workspace),
        null,
        2
      )
    );
  });
  lifecycleOptions(
    group
      .command("start [command...]", { hidden: false })
      .description("Start the configured discussion listener in the background")
  ).action(async (commandArgs: string[], options: LifecycleOptions) => {
    const store = new DiscussionListenerStateStore();
    const hasOverrides = Boolean(
      (commandArgs?.length ?? 0) || Object.values(options).some(Boolean)
    );
    if (hasOverrides)
      await writeDiscussionListenerConfig(options, commandArgs ?? [], store);
    else await store.readConfig();
    const supervisor = new DiscussionListenerSupervisorService(store);
    console.log(
      JSON.stringify(
        await (hasOverrides ? supervisor.restart() : supervisor.start()),
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
          await new DiscussionListenerSupervisorService().status(),
          null,
          2
        )
      )
    );
  group
    .command("stop")
    .description("Stop the configured discussion listener")
    .action(async () =>
      console.log(
        JSON.stringify(
          await new DiscussionListenerSupervisorService().stop(),
          null,
          2
        )
      )
    );
  group
    .command("restart")
    .description("Restart the configured discussion listener")
    .action(async () => {
      const store = new DiscussionListenerStateStore();
      console.log(
        JSON.stringify(
          await new DiscussionListenerSupervisorService(store).restart(),
          null,
          2
        )
      );
    });
  group.command("worker", { hidden: true }).action(async () => {
    const store = new DiscussionListenerStateStore();
    const config = await store.readConfig();
    const instanceId = process.env.NEXTCLAW_DISCUSSION_LISTENER_INSTANCE_ID;
    if (!instanceId)
      throw new Error(
        "Discussion worker must be started through `discussion listen start`."
      );
    const deadline = Date.now() + 5_000;
    let runtime = await store.readRuntime();
    while (runtime?.instanceId !== instanceId && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
      runtime = await store.readRuntime();
    }
    if (runtime?.instanceId !== instanceId || runtime.pid !== process.pid)
      throw new Error("Discussion listener runtime ownership was not established.");
    const token = (await readFile(config.tokenFile, "utf8")).trim();
    const worker = new DiscussionListenerWorkerService({
      discussion: new DiscussionClient({ endpoint: config.endpoint, token }),
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
          await dispatchCodexDesktopRunner(workspace),
          null,
          2
        )
      );
    });
  group
    .command("codex-desktop-runner", { hidden: true })
    .requiredOption("--workspace <path>", "Workspace used by this Codex consumer")
    .action(async (options: LifecycleOptions) => {
      const workspace = await resolveExistingDirectory(options.workspace, "--workspace");
      console.log(JSON.stringify(await new CodexDesktopDiscussionConsumerService().trigger(
        discussionCodexTriggerInputFromEnvironment(workspace)
      ), null, 2));
    });
}

async function dispatchCodexDesktopRunner(workspace: string): Promise<Record<string, unknown>> {
  const input = discussionCodexTriggerInputFromEnvironment(workspace);
  const store = new DiscussionListenerStateStore();
  await store.initialize();
  const existing = (await store.readCodexBindings()).discussions[input.discussionId]?.eventIds[input.eventId];
  if (existing) return { accepted: true, turnId: existing, reused: true };
  if (!process.argv[1]) throw new Error("Unable to locate the NextClaw CLI.");
  const log = await open(store.codexConsumerLogPath, "a", 0o600);
  const child = spawn(process.execPath, [process.argv[1], "discussion", "listen", "codex-desktop-runner", "--workspace", workspace], {
    detached: true,
    stdio: ["ignore", log.fd, log.fd],
    env: { ...process.env, NEXTCLAW_DISCUSSION_STATE_DIRECTORY: store.root },
  });
  await new Promise<void>((resolveSpawn, reject) => {
    child.once("spawn", resolveSpawn);
    child.once("error", reject);
  });
  child.unref();
  await log.close();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const turnId = (await store.readCodexBindings()).discussions[input.discussionId]?.eventIds[input.eventId];
    if (turnId) return { accepted: true, turnId, runnerPid: child.pid };
    try { if (child.pid) process.kill(child.pid, 0); }
    catch { break; }
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error(`Codex Desktop did not accept the discussion event. Check ${store.codexConsumerLogPath}.`);
}

function discussionListenerConfigOutput(
  config: DiscussionListenerConfig,
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

async function writeDiscussionListenerConfig(
  options: LifecycleOptions,
  commandArgs: string[],
  store = new DiscussionListenerStateStore()
): Promise<DiscussionListenerConfig> {
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
    throw new Error("Unknown discussion consumer preset.");
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
    "discussion",
    "listen",
    "codex-desktop-trigger",
    "--workspace",
    workspace,
  ];
}
