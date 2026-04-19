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
import type { AgentCommandOptions } from "../../shared/types/cli.types.js";
import { printAgentResponse, prompt } from "../../shared/utils/cli.utils.js";
import { createUiNcpAgent } from "../ncp/features/runtime/create-ui-ncp-agent.service.js";
import { dispatchPromptOverNcp } from "../ncp/features/runtime/nextclaw-ncp-dispatch.js";
import type { NextclawExtensionRegistry } from "../plugins.js";

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
  console.log(`${params.logo} Interactive mode (type exit or Ctrl+C to quit)\n`);
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
      config: params.config,
      sessionManager: params.sessionManager,
      resolveNcpAgent: () => params.ncpAgent,
      sessionKey: params.sessionKey,
      content: trimmed,
      metadata: params.metadata,
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
  const bus = new MessageBus();
  const sessionManager = new SessionManager({
    workspace: params.workspace,
    homeDir: getDataDir(),
  });
  const ncpAgent = await createUiNcpAgent({
    bus,
    providerManager: params.providerManager,
    sessionManager,
    getConfig: params.loadResolvedConfig,
    getExtensionRegistry: () => params.extensionRegistry,
    resolveMessageToolHints: ({ channel, accountId }) =>
      params.resolveMessageToolHints({ channel, accountId }),
  });

  try {
    const sessionKey = params.opts.session ?? "cli:default";
    const sharedMetadata = buildCliSharedMetadata(params.opts);

    if (params.opts.message) {
      const response = await dispatchPromptOverNcp({
        config: params.config,
        sessionManager,
        resolveNcpAgent: () => ncpAgent,
        sessionKey,
        content: params.opts.message,
        metadata: sharedMetadata,
      });
      printAgentResponse(response);
      return;
    }

    await runCliInteractiveLoop({
      logo: params.logo,
      config: params.config,
      sessionManager,
      ncpAgent,
      sessionKey,
      metadata: sharedMetadata,
    });
  } finally {
    await ncpAgent.dispose?.();
  }
}
