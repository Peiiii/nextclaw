import type { Command } from "commander";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  AgentIdentity,
  Connection,
} from "../types/collaboration.types.js";
import type { CliContext } from "../types/cli.types.js";
import { createIdentity } from "../utils/identity.utils.js";
import { loadSource } from "../utils/source-registry.utils.js";
import { migrateDiscussion } from "../utils/migration.utils.js";
const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));
export function registerConnectionCommands(
  program: Command,
  context: CliContext,
): void {
  const { root, open, stopped } = context;
  program
    .command("connect <id>")
    .description("Add a platform connection using existing local login")
    .requiredOption(
      "--adapter <id>",
      "github, linear, official or an installed adapter ID",
    )
    .requiredOption("--workspace <path>", "Codex working directory")
    .option("--repository <owner/repo>")
    .option("--team <key>")
    .option("--platform-workspace <slug>")
    .option("--label <name>", "Invitation label", "agent:mozhao")
    .option("--executable <path>", "Platform CLI executable")
    .option("--codex <path>", "Codex executable")
    .option("--endpoint <url>")
    .option("--token-file <path>")
    .option("--module <path>")
    .option("--agent <id>", "Independent agent identity", "mozhao")
    .option(
      "--allow <accounts>",
      "Comma-separated allowed platform accounts (defaults to current account)",
    )
    .option(
      "--command-json <argv>",
      "Use a JSON command consumer instead of Codex",
    )
    .option("--options-json <json>", "Additional custom adapter options", "{}")
    .action(async (id: string, options) => {
      const {
        adapter,
        agent: agentOption,
        allow,
        codex,
        commandJson,
        endpoint,
        executable,
        label,
        module,
        optionsJson,
        platformWorkspace,
        repository,
        team,
        tokenFile,
        workspace: workspaceOption,
      } = options;
      const store = open();
      try {
        stopped(store);
        if (!/^[\w-]{1,80}$/.test(id))
          throw new Error(
            "Connection ID must be 1–80 letters, digits, hyphens or underscores",
          );
        if (store.get("connection", id))
          throw new Error(
            "Connection exists; use its existing binding or remove explicitly after stopping",
          );
        const identityPath = join(root(), `${agentOption}.identity.json`);
        let agent: AgentIdentity;
        if (existsSync(identityPath))
          agent = JSON.parse(readFileSync(identityPath, "utf8"));
        else {
          agent = createIdentity(root(), agentOption);
          writeFileSync(identityPath, JSON.stringify(agent), { mode: 0o600 });
        }
        const workspace = resolve(workspaceOption);
        if (!existsSync(workspace))
          throw new Error("Consumer workspace does not exist");
        const connection: Connection = {
          id,
          adapter: adapter,
          agent,
          trustedAgents: [],
          allowedAccounts: [],
          options: {
            ...JSON.parse(optionsJson),
            ...Object.fromEntries(
              Object.entries({
                repository: repository,
                team: team,
                workspace: platformWorkspace,
                label: label,
                executable:
                  executable ||
                  (adapter === "linear" ? discoverLinear() : undefined),
                endpoint: endpoint,
                tokenFile: tokenFile,
                module: module
                  ? resolve(module)
                  : store.get<{ path: string }>("adapter", adapter)?.path,
              }).filter(([, value]) => value !== undefined),
            ),
          } as Record<string, string>,
          consumer: commandJson
            ? {
                kind: "command",
                command: JSON.parse(commandJson),
                workspace,
              }
            : { kind: "codex", workspace, executable: codex },
          source: "",
          account: "",
          since: new Date().toISOString(),
          enabled: true,
          intervalMs: 30_000,
          maxAgentHops: 4,
          maxRunsPerHour: 12,
        };
        const source = await loadSource(connection);
        const check = await source.check();
        if (source.reply && !check.writable)
          throw new Error("Account lacks the required write permission");
        connection.source = check.source;
        connection.account = check.account;
        connection.allowedAccounts = allow ? allow.split(",") : [check.account];
        if (
          store
            .list<Connection>("connection")
            .some(
              (c) => c.source === connection.source && c.agent.id === agent.id,
            )
        )
          throw new Error(
            "This agentOption already has a connection for the same source",
          );
        store.put("connection", id, connection);
        print({
          id,
          source: check.source,
          account: check.account,
          agentId: agent.id,
          label: label,
          status: "连接已检查；运行 start 后，在新 Issue 添加邀请标签",
          publicKey: agent.publicKey,
        });
      } finally {
        store.close();
      }
    });
  registerAdapterCommands(program, context);
}

function registerAdapterCommands(program: Command, context: CliContext): void {
  const { root, open, stopped } = context;
  program
    .command("install-adapter <module>")
    .description("Register an explicitly installed trusted adapter module")
    .action(async (file: string) => {
      const path = resolve(file);
      const module = await import(pathToFileURL(path).href);
      if (
        module.contractVersion !== 1 ||
        typeof module.adapterId !== "string" ||
        !/^[\w-]+$/.test(module.adapterId) ||
        typeof module.createSource !== "function"
      )
        throw new Error(
          "Module must export adapterId, contractVersion=1 and createSource",
        );
      const store = open();
      try {
        stopped(store);
        store.put("adapter", module.adapterId, {
          id: module.adapterId,
          path,
          contractVersion: 1,
        });
        print({ installed: module.adapterId, path });
      } finally {
        store.close();
      }
    });
  program
    .command("adapters")
    .description("List builtin and explicitly installed source adapters")
    .action(() => {
      const store = open();
      try {
        print({
          builtin: ["github", "linear", "official"],
          installed: store.list("adapter"),
        });
      } finally {
        store.close();
      }
    });
  program
    .command("trust <connection> <identity-file> <account>")
    .description("Trust a peer agent identity on a specific platform account")
    .option(
      "--controls",
      "Explicitly allow this peer to send pause/resume/cancel controls",
      false,
    )
    .action((id: string, file: string, account: string, options) => {
      const store = open();
      try {
        stopped(store);
        const connection = store.get<Connection>("connection", id);
        if (!connection) throw new Error("Connection not found");
        const peer = JSON.parse(readFileSync(file, "utf8")) as AgentIdentity;
        connection.trustedAgents = [
          ...connection.trustedAgents.filter((a) => a.id !== peer.id),
          {
            id: peer.id,
            publicKey: peer.publicKey,
            account,
            controls: options.controls,
          },
        ];
        store.put("connection", id, connection);
        print({ trusted: peer.id, account });
      } finally {
        store.close();
      }
    });
  program
    .command("migrate-discussion")
    .requiredOption("--workspace <path>")
    .option(
      "--legacy-dir <path>",
      "Old listener state",
      join(homedir(), ".nextclaw", "discussion-listener"),
    )
    .description(
      "Import stopped official listener bindings and checkpoint without replay",
    )
    .action(async (options) => {
      const store = open();
      try {
        stopped(store);
        const identityPath = join(root(), "mozhao.identity.json");
        const agent: AgentIdentity = existsSync(identityPath)
          ? JSON.parse(readFileSync(identityPath, "utf8"))
          : createIdentity(root(), "mozhao");
        if (!existsSync(identityPath))
          writeFileSync(identityPath, JSON.stringify(agent), { mode: 0o600 });
        print(
          await migrateDiscussion(
            store,
            resolve(options.legacyDir),
            resolve(options.workspace),
            agent,
          ),
        );
      } finally {
        store.close();
      }
    });
}
function discoverLinear(): string {
  const versions = join(homedir(), ".nvm", "versions", "node");
  const candidates = [
    join(homedir(), ".local", "bin", "linear"),
    "/opt/homebrew/bin/linear",
    ...(existsSync(versions)
      ? readdirSync(versions)
          .sort()
          .reverse()
          .map((v) => join(versions, v, "bin", "linear"))
      : []),
  ];
  return candidates.find(existsSync) || "linear";
}
