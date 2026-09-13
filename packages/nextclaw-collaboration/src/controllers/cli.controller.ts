#!/usr/bin/env node
import type { CliContext } from "../types/cli.types.js";
import { registerConnectionCommands } from "./cli-connection.controller.js";
import { Command } from "commander";
import { spawn } from "node:child_process";
import {
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  existsSync,
  closeSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { CollaborationStore } from "../stores/collaboration.store.js";
import { CollaborationHost } from "../services/host.service.js";
import { digest } from "../utils/identity.utils.js";
import { loadSource } from "../utils/source-registry.utils.js";
import { createEventIngress } from "../utils/event-ingress.utils.js";
import { CollaborationService } from "../services/collaboration.service.js";
import { CodexConsumer } from "../services/codex-consumer.service.js";
import type {
  Connection,
  ContextState,
  OutboxEntry,
  Run,
  StoredEvent,
} from "../types/collaboration.types.js";

const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));
export function registerCollaborationCommands(program: Command): void {
  program.option(
    "--state-dir <path>",
    "Local state directory",
    join(homedir(), ".nextclaw", "collaboration"),
  );
  const root = () => resolve(program.opts().stateDir);
  const open = () => new CollaborationStore(join(root(), "state.sqlite"));
  const stopped = (store: CollaborationStore) => {
    const host = store.get<{ heartbeatAt: string }>("runtime", "host");
    if (host && Date.now() - Date.parse(host.heartbeatAt) < 60_000)
      throw new Error(
        "Stop the collaboration host before changing connections",
      );
  };
  registerConnectionCommands(program, { root, open, stopped });
  registerRecoveryCommands(program, { root, open, stopped });
  registerInspectionCommands(program, { root, open, stopped });
  registerIngressCommands(program, { root, open, stopped });
  registerDeliveryCommands(program, { root, open, stopped });
  registerConversationCommands(program, { root, open, stopped });
  registerRuntimeCommands(program, { root, open, stopped });
}

function registerRecoveryCommands(program: Command, context: CliContext): void {
  const { open, stopped } = context;
  program
    .command("bind <context> <thread>")
    .description(
      "Explicitly repair a binding using an existing idle Codex task",
    )
    .action(async (key: string, threadId: string) => {
      const store = open();
      try {
        stopped(store);
        const context = store.get<ContextState>("context", key);
        if (!context) throw new Error("Context not found");
        if (
          store
            .list<Run>("run")
            .some(
              (r) =>
                r.contextKey === key &&
                ["running", "submitting", "unknown"].includes(r.state),
            )
        )
          throw new Error(
            "Resolve the previous execution before changing its task binding",
          );
        const connection = store.get<Connection>(
          "connection",
          context.connectionId,
        )!;
        if (connection.consumer.kind !== "codex")
          throw new Error("This repair command requires a Codex consumer");
        const consumer = new CodexConsumer(
          connection.consumer.workspace,
          connection.consumer.executable,
        );
        try {
          await consumer.validateThread(threadId);
        } finally {
          await consumer.close();
        }
        context.threadId = threadId;
        context.status = "绑定已修复；请显式恢复跟进";
        context.paused = true;
        store.putContext(context);
        print(context);
      } finally {
        store.close();
      }
    });
  program
    .command("reconcile <context>")
    .description("Recheck unknown executions without resubmitting work")
    .action((key: string) => {
      const store = open();
      try {
        for (const run of store
          .list<Run>("run")
          .filter((r) => r.contextKey === key && r.state === "unknown"))
          store.put("run", run.id, { ...run, state: "submitting" });
        print({ context: key, status: "执行查询已排队；不会重新发起任务" });
      } finally {
        store.close();
      }
    });
  program
    .command("retry-run <id>")
    .description(
      "Explicitly retry failed/cancelled work after inspecting side effects",
    )
    .requiredOption(
      "--confirm-safe",
      "You have verified that replaying this input is safe",
    )
    .action((id: string) => {
      const store = open();
      try {
        stopped(store);
        const run = store.get<Run>("run", id);
        if (!run || !["failed", "cancelled", "unknown"].includes(run.state))
          throw new Error("Run must be failed, cancelled or unknown");
        const context = store.get<ContextState>("context", run.contextKey)!;
        store.transaction(() => {
          for (const key of run.eventIds) {
            const input = store.get<StoredEvent>("event", key);
            if (!input?.event.data.body)
              throw new Error(
                "Original input is no longer retained; submit a new explicit request",
              );
            store.put("event", key, { ...input, state: "pending" });
          }
          store.put("run", id, { ...run, state: "cancelled" });
          context.paused = false;
          context.status = "已明确授权重试";
          store.putContext(context);
        });
        print({ retried: id });
      } finally {
        store.close();
      }
    });
}

function registerInspectionCommands(
  program: Command,
  context: CliContext,
): void {
  const { open } = context;
  program
    .command("status")
    .description("Show connections, tasks and runtime without starting a model")
    .action(() => {
      const store = open();
      try {
        print({
          runtime: store.list("runtime"),
          connections: store.list<Connection>("connection").map((c) => ({
            id: c.id,
            source: c.source,
            account: c.account,
            agent: c.agent.id,
            enabled: c.enabled,
            lastScan: c.lastScan,
            error: c.error,
          })),
          contexts: store.list<ContextState>("context"),
          runs: store
            .list<Run>("run")
            .slice(-20)
            .map(({ text: _text, ...run }) => run),
        });
      } finally {
        store.close();
      }
    });
  program
    .command("check")
    .argument("[id]")
    .description("Check configured source authentication and identity")
    .action(async (id?: string) => {
      const store = open();
      try {
        for (const connection of store
          .list<Connection>("connection")
          .filter((c) => !id || c.id === id)) {
          const check = await (await loadSource(connection)).check();
          print({
            id: connection.id,
            ...check,
            matches:
              check.account === connection.account &&
              check.source === connection.source,
          });
        }
      } finally {
        store.close();
      }
    });
  program
    .command("show <context>")
    .description("Inspect a task, its results and delivery failures")
    .action((key: string) => {
      const store = open();
      try {
        print({
          context: store.get("context", key),
          runs: store.list<Run>("run").filter((r) => r.contextKey === key),
          outputs: store
            .list<OutboxEntry>("outbox")
            .filter((e) => e.contextKey === key)
            .map(({ operation, ...entry }) => ({
              ...entry,
              purpose: operation.purpose,
            })),
        });
      } finally {
        store.close();
      }
    });
}

function registerIngressCommands(program: Command, context: CliContext): void {
  const { open } = context;
  program
    .command("ingest <connection> <file>")
    .description("Durably accept a CloudEvent from a trusted local producer")
    .action((id: string, file: string) => {
      const store = open();
      try {
        const connection = store.get<Connection>("connection", id);
        if (!connection?.enabled) throw new Error("Connection is not enabled");
        const event = JSON.parse(readFileSync(file === "-" ? 0 : file, "utf8"));
        const service = new CollaborationService(store, new Map(), new Map());
        store.transaction(() => service.ingest(connection, event));
        print({ accepted: event.id });
      } finally {
        store.close();
      }
    });
  program
    .command("serve-events <connection>")
    .description(
      "Serve authenticated protocol events (optional; platform polling needs no server)",
    )
    .requiredOption("--token-file <path>")
    .option("--port <number>", "Listen port", "8789")
    .option("--host <address>", "Listen address", "127.0.0.1")
    .action(async (id: string, options) => {
      const store = open();
      const server = createEventIngress(
        store,
        id,
        readFileSync(options.tokenFile, "utf8").trim(),
      );
      server.requestTimeout = 15_000;
      server.headersTimeout = 10_000;
      const stop = () => server.close(() => store.close());
      process.once("SIGTERM", stop);
      process.once("SIGINT", stop);
      await new Promise<void>((resolveListen, reject) => {
        server.once("error", reject);
        server.listen(Number(options.port), options.host, resolveListen);
      });
      print({ listening: server.address(), path: "/events" });
    });
}

function registerDeliveryCommands(program: Command, context: CliContext): void {
  const { open, stopped } = context;
  program
    .command("resolve-output <id>")
    .description(
      "Reconcile uncertain delivery; retry or discard only after manual verification",
    )
    .option(
      "--confirm-not-delivered",
      "You verified the operation did not reach the platform",
    )
    .option("--discard", "Discard the obsolete output instead of retrying")
    .action(async (id: string, options) => {
      const store = open();
      try {
        stopped(store);
        const entry = store.get<OutboxEntry>("outbox", id);
        if (!entry || !["unknown", "sending"].includes(entry.state))
          throw new Error("Output is not uncertain");
        const context = store.get<ContextState>("context", entry.contextKey)!;
        const connection = store.get<Connection>(
          "connection",
          context.connectionId,
        )!;
        const source = await loadSource(connection);
        const found = await source.findReply?.(context.subject, id);
        if (found) {
          entry.messageId = found;
          entry.state = "sent";
          store.put("own-output", `${connection.id}:${found}`, {
            operationId: id,
          });
        } else if (options.confirmNotDelivered)
          entry.state = options.discard ? "superseded" : "pending";
        else
          throw new Error(
            "No matching output found; inspect the platform before confirming absence",
          );
        entry.error = undefined;
        store.put("outbox", id, entry);
        print({ id, state: entry.state, messageId: entry.messageId });
      } finally {
        store.close();
      }
    });
}

function registerConversationCommands(
  program: Command,
  context: CliContext,
): void {
  const { open } = context;
  program
    .command("follow <connection> <subject>")
    .description("Explicitly invite this agent to an existing source object")
    .action(async (id: string, subject: string) => {
      const store = open();
      try {
        const connection = store.get<Connection>("connection", id);
        if (!connection) throw new Error("Connection not found");
        const view = await (await loadSource(connection)).readContext(subject);
        const eventId = randomUUID();
        const input: StoredEvent = {
          key: eventId,
          connectionId: id,
          state: "pending",
          receivedAt: new Date().toISOString(),
          event: {
            specversion: "1.0",
            source: connection.source,
            subject: view.subject,
            id: eventId,
            type: "local.invitation",
            time: new Date().toISOString(),
            data: {
              actor: { account: connection.account },
              resourceId: eventId,
              body: view.body,
              change: "context",
              invited: true,
            },
          },
        };
        store.put("event", eventId, input);
        print({ invited: view.url, context: digest(`${id}\0${view.subject}`) });
      } finally {
        store.close();
      }
    });
  program
    .command("control <context> <action>")
    .description("Queue status, pause, resume or cancel for a context key")
    .action((key: string, action: string) => {
      if (!["status", "pause", "resume", "cancel"].includes(action))
        throw new Error("Unknown control action");
      const store = open();
      try {
        const context = store.get<ContextState>("context", key);
        if (!context) throw new Error("Context not found");
        const connection = store.get<Connection>(
          "connection",
          context.connectionId,
        )!;
        const id = randomUUID();
        const input: StoredEvent = {
          key: id,
          connectionId: connection.id,
          state: "pending",
          receivedAt: new Date().toISOString(),
          event: {
            specversion: "1.0",
            source: connection.source,
            subject: context.subject,
            id,
            type: "local.control",
            time: new Date().toISOString(),
            data: {
              actor: { account: connection.account },
              resourceId: id,
              body: `/agent ${action}`,
              change: "message",
            },
          },
        };
        store.put("event", id, input);
        print({ queued: action, context: key });
      } finally {
        store.close();
      }
    });
}

function registerRuntimeCommands(program: Command, context: CliContext): void {
  const { root, open, stopped } = context;
  program
    .command("run")
    .description("Run the local host in the foreground")
    .action(async () => {
      const store = open();
      try {
        await new CollaborationHost(store, root()).run();
      } finally {
        store.close();
      }
    });
  program
    .command("start")
    .description("Start the local host in the background")
    .action(() => {
      const store = open();
      try {
        stopped(store);
      } finally {
        store.close();
      }
      mkdirSync(root(), { recursive: true, mode: 0o700 });
      const log = openSync(join(root(), "host.log"), "a", 0o600);
      const child = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), "--state-dir", root(), "run"],
        { detached: true, stdio: ["ignore", log, log] },
      );
      child.unref();
      closeSync(log);
      print({ pid: child.pid, status: "启动已提交；用 status 查看健康状态" });
    });
  program
    .command("stop")
    .description("Stop this host; preserve bindings and recoverable work")
    .action(async () => {
      const store = open();
      try {
        const runtime = store.get<{ owner: string; heartbeatAt: string }>(
          "runtime",
          "host",
        );
        if (
          !runtime ||
          Date.now() - Date.parse(runtime.heartbeatAt) >= 60_000
        ) {
          print({ status: "没有活跃宿主" });
          return;
        }
        store.put("runtime", "stop", { owner: runtime.owner });
        const deadline = Date.now() + 45_000;
        while (
          runtime &&
          store.get<{ owner: string }>("runtime", "host")?.owner ===
            runtime.owner &&
          Date.now() < deadline
        )
          await new Promise((resolve) => setTimeout(resolve, 250));
        if (
          runtime &&
          store.get<{ owner: string }>("runtime", "host")?.owner ===
            runtime.owner
        )
          throw new Error(
            "Shutdown is still pending; inspect status before restarting",
          );
        print({ status: "已停止，绑定和待处理输入已保留" });
      } finally {
        store.close();
      }
    });
  program
    .command("restart")
    .description("Restart the shared host after confirmed shutdown")
    .action(async () => {
      await runCollaborationCli(["--state-dir", root(), "stop"]);
      await runCollaborationCli(["--state-dir", root(), "start"]);
    });
}

export async function runCollaborationCli(args: string[]): Promise<void> {
  const { version } = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  const program = new Command().name("nextclaw-collaboration").version(version);
  registerCollaborationCommands(program);
  await program.parseAsync(args, { from: "user" });
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href
) {
  runCollaborationCli(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
