import {
  MessageBus,
  SessionManager,
  getDataDir,
  type Config,
  type ProviderManager,
} from "@nextclaw/core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { AgentCommandOptions } from "@nextclaw-service/shared/types/cli.types.js";
import { printAgentResponse, prompt } from "@nextclaw-service/shared/utils/cli.utils.js";
import { createUiNcpAgent } from "@nextclaw-service/commands/ncp/features/runtime/create-ui-ncp-agent.service.js";
import { dispatchPromptOverNcp } from "@nextclaw-service/commands/ncp/features/runtime/nextclaw-ncp-dispatch.utils.js";
import type { NextclawExtensionRegistry } from "@nextclaw-service/commands/plugin/index.js";

const EXIT_COMMANDS = new Set(["exit", "quit", "/exit", "/quit", ":q"]);

function buildCliSharedMetadata(
  opts: Pick<AgentCommandOptions, "model">,
): Record<string, unknown> {
  return typeof opts.model === "string" && opts.model.trim()
    ? { model: opts.model.trim() }
    : {};
}

function createCliHistoryInterface() {
  const historyFile = join(getDataDir(), "history", "cli_history");
  const historyDir = resolve(historyFile, "..");
  mkdirSync(historyDir, { recursive: true });

  const history = existsSync(historyFile)
    ? readFileSync(historyFile, "utf-8").split("\n").filter(Boolean)
    : [];
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.on("close", () => {
    const merged = history.concat(
      (rl as unknown as { history: string[] }).history ?? [],
    );
    writeFileSync(historyFile, merged.join("\n"));
    process.exit(0);
  });

  return rl;
}

async function runCliInteractiveLoop(params: {
  logo: string;
  config: Config;
  sessionManager: SessionManager;
  ncpAgent: Awaited<ReturnType<typeof createUiNcpAgent>>;
  sessionKey: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const { config, logo, metadata, ncpAgent, sessionKey, sessionManager } = params;
  console.log(`${logo} Interactive mode (type exit or Ctrl+C to quit)\n`);
  const rl = createCliHistoryInterface();

  let running = true;
  while (running) {
    const line = await prompt(rl, "You: ");
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (EXIT_COMMANDS.has(trimmed.toLowerCase())) {
      rl.close();
      running = false;
      break;
    }
    const response = await dispatchPromptOverNcp({
      config,
      sessionManager,
      resolveNcpAgent: () => ncpAgent,
      sessionKey,
      content: trimmed,
      metadata,
    });
    printAgentResponse(response);
  }
}

export async function runCliAgentCommand(params: {
  logo: string;
  opts: AgentCommandOptions;
  config: Config;
  workspace: string;
  providerManager: ProviderManager;
  extensionRegistry: NextclawExtensionRegistry;
  loadResolvedConfig: () => Config;
  resolveMessageToolHints: (params: {
    channel: string;
    accountId?: string | null;
  }) => string[];
}): Promise<void> {
  const {
    config,
    extensionRegistry,
    loadResolvedConfig,
    logo,
    opts,
    providerManager,
    resolveMessageToolHints,
    workspace,
  } = params;
  const bus = new MessageBus();
  const sessionManager = new SessionManager({
    workspace,
    homeDir: getDataDir(),
  });
  const ncpAgent = await createUiNcpAgent({
    bus,
    providerManager,
    sessionManager,
    getConfig: loadResolvedConfig,
    getExtensionRegistry: () => extensionRegistry,
    resolveMessageToolHints: ({ channel, accountId }) =>
      resolveMessageToolHints({ channel, accountId }),
  });

  try {
    const sessionKey = opts.session ?? "cli:default";
    const sharedMetadata = buildCliSharedMetadata(opts);

    if (opts.message) {
      const response = await dispatchPromptOverNcp({
        config,
        sessionManager,
        resolveNcpAgent: () => ncpAgent,
        sessionKey,
        content: opts.message,
        metadata: sharedMetadata,
      });
      printAgentResponse(response);
      return;
    }

    await runCliInteractiveLoop({
      logo,
      config,
      sessionManager,
      ncpAgent,
      sessionKey,
      metadata: sharedMetadata,
    });
  } finally {
    await ncpAgent.dispose?.();
  }
}
