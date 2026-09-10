import { appendFile, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { ConfigSchema, ExecTool, saveConfig } from "@nextclaw/core";
import { NextclawKernel } from "@nextclaw/kernel";
import { ingressKeys } from "@nextclaw/shared";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { ncpMessageToOpenAiMessages } from "@nextclaw/ncp-agent-runtime";
import { RuntimeControlRoutesController } from "@nextclaw/server";
import { NpmRuntimeLauncher } from "@nextclaw-service/launcher/npm-runtime-launcher.service.js";
import { NextclawServiceRuntime } from "@nextclaw-service/app/nextclaw-service-runtime.js";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";
import { ServiceRestartManager } from "@nextclaw-service/managers/service-restart.manager.js";
import { RuntimeControlHost } from "@nextclaw-service/services/ui/runtime-control-host.service.js";
import { localUiRuntimeStore } from "@nextclaw-service/stores/local-ui-runtime.store.js";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing acceptance environment: ${name}`);
  return value;
}
const home = required("NEXTCLAW_HOME");
const outputPath = required("NEXTCLAW_ACCEPTANCE_OUTPUT");
const launcherPath = required("NEXTCLAW_ACCEPTANCE_LAUNCHER");
const version = process.env.NEXTCLAW_ACCEPTANCE_VERSION ?? "0.1.0";
const record = async (event: Record<string, unknown>): Promise<void> => {
  await appendFile(outputPath, `${JSON.stringify({ pid: process.pid, version, ...event })}\n`);
};
process.on("uncaughtException", (error) => { void record({ phase: "fatal", error: String(error) }).then(() => process.exit(1)); });
process.on("unhandledRejection", (error) => { void record({ phase: "fatal", error: String(error) }).then(() => process.exit(1)); });
const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
const waitUntil = async (condition: () => boolean): Promise<void> => {
  const deadline = Date.now() + 20_000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("acceptance condition timed out");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
};

NextclawDistributionService.configure({
  version, productEnvironment: "test", releaseChannel: "stable",
  appEntrypoint: launcherPath, launcherVersion: "0.1.0", launcherEntrypoint: launcherPath,
  launchedByLauncher: true, templatesDir: home, uiDistDir: home,
  runtimeUpdatePublicKeyPath: required("NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY_PATH"),
});

const command = process.argv[2];
if (command === "update" || command === "restart") {
  await record({ phase: "command", command });
  const cli = new NextclawServiceRuntime({});
  if (command === "update") await cli.update({ json: true });
  else await cli.commands.restart.run({ open: false });
  process.exit(0);
}
if (command === "start") {
  const child = spawn(process.execPath, [launcherPath, "launch-runtime"], {
    detached: true, stdio: "ignore", env: process.env,
  });
  child.unref();
  await waitUntil(() => {
    const state = managedServiceStateStore.read();
    if (!state) return false;
    try { process.kill(state.pid, 0); return true; } catch { return false; }
  });
  process.exit(0);
}
if (command === "launch-runtime") {
  await new NpmRuntimeLauncher({
    argv: [process.execPath, launcherPath], launcherVersion: "0.1.0",
    packagedPortableRunnerPath: required("NEXTCLAW_ACCEPTANCE_PACKAGED_RUNNER"),
  }).run();
}

const successor = version === "0.1.1";
const generationPath = join(home, "generation");
const generation = Number(await readFile(generationPath, "utf8").catch(() => "-1")) + 1;
await writeFile(generationPath, String(generation));
await record({ phase: "process-generation", generation });
const configPath = join(home, "config.json");
if (!successor) {
  saveConfig(ConfigSchema.parse({
    agents: { defaults: { workspace: join(home, "workspace"), model: "fixture-model" } },
  }), configPath);
}
const kernel = new NextclawKernel({ homeDir: home, configPath });
await kernel.start();
const started = new Set<string>();
const finished = new Set<string>();
async function prepareRestartCommand(sessionId: string): Promise<{ exec: ExecTool; command: string }> {
  const exec = new ExecTool({ workingDir: home, timeout: 30 });
  exec.setContext({ sessionKey: sessionId });
  const cli = `${quote(process.execPath)} ${quote(launcherPath)}`;
  if (!successor) {
    const updated = await exec.execute({ command: `${cli} update` });
    if (!updated.ok) throw new Error(JSON.stringify(updated));
    await record({ phase: "updated", output: updated.stdout });
  }
  return { exec, command: `${cli} restart` };
}
type FixtureRuntime = ReturnType<Parameters<typeof kernel.agentRuntimeManager.register>[0]["createRuntime"]>;
const scriptedRuntime: FixtureRuntime = {
  run: async function* (spec, options) {
    const sessionId = options.session.sessionId;
    const messageId = `${spec.runId}-assistant`;
    const prompt = options.initialMessages.flatMap((message) => message.parts)
      .filter((part) => part.type === "text").map((part) => part.text).join(" ");
    await record({ phase: "run-start", sessionId, prompt, generation });
    yield { type: NcpEventType.RunStarted, payload: { sessionId, runId: spec.runId } };
    started.add(sessionId);
    if (sessionId === "session-failed") {
      yield { type: NcpEventType.RunError, payload: { sessionId, runId: spec.runId, error: "ordinary failure" } };
      return;
    }
    if ((!successor || prompt.startsWith("second-cycle")) && sessionId !== "session-completed") {
      yield { type: NcpEventType.MessageSent, payload: { sessionId, message: {
        id: messageId, sessionId, role: "assistant", status: "streaming",
        timestamp: new Date().toISOString(), parts: [{ type: "text", text: `saved-progress:${sessionId}` }],
      } } };
      if (sessionId === "session-initiator") {
        await waitUntil(() => started.has("session-parallel"));
        const { exec, command: restartCommand } = await prepareRestartCommand(sessionId);
        yield { type: NcpEventType.MessageToolCallStart, payload: {
          sessionId, messageId, toolCallId: "restart-call", toolName: "exec",
        } };
        yield { type: NcpEventType.MessageToolCallArgs, payload: {
          sessionId, messageId, toolCallId: "restart-call", args: JSON.stringify({ command: restartCommand }),
        } };
        // The result never reaches the journal: the host really exits with this call unfinished.
        await exec.execute({ command: restartCommand });
      }
      await new Promise<void>(() => undefined);
      return;
    }
    const history = options.sessionRun.getSnapshot().messages;
    const recovery = prompt.includes("Do not repeat the update or restart command");
    const modelMessages = history.flatMap((message) => ncpMessageToOpenAiMessages(message));
    await record({ phase: recovery ? "model-input" : "ordinary-input", sessionId, prompt, history, modelMessages, generation });
    if (successor && !recovery && !prompt.startsWith("follow-up")) {
      throw new Error("recovery omitted the completed restart receipt");
    }
    const message: NcpMessage = {
      id: messageId, sessionId, role: "assistant", status: "final",
      timestamp: new Date().toISOString(), parts: [{ type: "text", text: `completed:${sessionId}` }],
    };
    yield { type: NcpEventType.MessageSent, payload: { sessionId, message } };
    yield { type: NcpEventType.MessageCompleted, payload: { sessionId, message } };
    yield { type: NcpEventType.RunFinished, payload: { sessionId, runId: spec.runId } };
    finished.add(sessionId);
  },
};
const runtime: FixtureRuntime = {
  run: async function* (spec, options) {
    for await (const event of scriptedRuntime.run(spec, options)) {
      await options.sessionRun.applyEvents([event]);
      yield event;
    }
  },
};
kernel.agentRuntimeManager.register({
  kind: "acceptance", label: "Deterministic acceptance model", defaultReuseScope: "session",
  createRuntime: () => runtime,
});
kernel.agentRuntimeManager.registerEntry({ id: "acceptance", type: "acceptance", label: "Acceptance" });

async function startControlServer(): Promise<void> {
  const restart = new ServiceRestartManager({ managedService: {} as never });
  restart.installPlannedRestartRecovery(kernel.plannedRestartRecovery);
  const host = new RuntimeControlHost({
    requestRestart: restart.requestRestart,
    serviceCommands: { startService: async () => { throw new Error("unexpected start"); }, stopService: async () => undefined },
    uiConfig: { host: "127.0.0.1", port: 0 },
  });
  const routes = new RuntimeControlRoutesController(host);
  const server = createServer(async (request, response) => {
    if (request.url !== "/api/runtime/control/restart-service" || request.method !== "POST") {
      response.writeHead(404).end();
      return;
    }
    const result = await routes.restartService({
      json: (data: unknown, status: number = 200) => Response.json(data, { status }),
    } as unknown as Parameters<typeof routes.restartService>[0]);
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
  });
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server missing address");
  localUiRuntimeStore.write({
    pid: process.pid, startedAt: new Date().toISOString(), uiPort: address.port, uiHost: "127.0.0.1",
    uiUrl: `http://127.0.0.1:${address.port}`, apiUrl: `http://127.0.0.1:${address.port}/api`,
  });
  const config = ConfigSchema.parse(JSON.parse(await readFile(configPath, "utf8")));
  config.ui.port = address.port;
  saveConfig(config, configPath);
  if (successor) managedServiceStateStore.write({
    ...localUiRuntimeStore.read()!, logPath: outputPath,
  });
}

async function sendTask(sessionId: string, content: string): Promise<void> {
    const accepted = await kernel.ingress.handle({
      type: ingressKeys.agentRun.send,
      payload: { sessionId, metadata: { agentRuntimeId: "acceptance" }, content: [{ type: "text", text: content }] },
    }, { source: "acceptance" });
    await record({ phase: "send-accepted", sessionId, content, accepted });
}

await startControlServer();
if (!successor) {
  for (const sessionId of ["session-completed", "session-failed", "session-initiator", "session-parallel"]) {
    await sendTask(sessionId, `task:${sessionId}`);
  }
  await record({ phase: "old-running" });
} else {
  await record({ phase: "runtime-booted" });
  const first = await kernel.plannedRestartRecovery.recover(process.env.NEXTCLAW_RESTART_OPERATION_ID);
  await record({ phase: "recovery-accepted", first });
  await waitUntil(() => finished.size === 2);
  await kernel.sessionManager.flushSessionEvents();
  const second = await kernel.plannedRestartRecovery.recover(process.env.NEXTCLAW_RESTART_OPERATION_ID);
  const sessions = await Promise.all([...finished].map((id) => kernel.sessionManager.getSessionRecord(id)));
  await record({ phase: "recovered", first, second, sessions, generation });
  if (generation === 1) {
    started.clear();
    finished.clear();
    for (const sessionId of ["session-initiator", "session-parallel"]) {
      await sendTask(sessionId, `second-cycle:${sessionId}`);
    }
  } else {
    finished.clear();
    await sendTask("session-initiator", "follow-up: verify normal input works after two restarts");
    await waitUntil(() => finished.has("session-initiator"));
    await kernel.sessionManager.flushSessionEvents();
    await record({ phase: "acceptance-complete" });
    await kernel.dispose();
  }
  // Remain a live managed target until the parent test has collected the evidence.
  setInterval(() => undefined, 1_000);
}
