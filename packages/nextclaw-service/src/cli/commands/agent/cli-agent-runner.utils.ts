import {
  getDataDir,
  type Config,
} from "@nextclaw/core";
import {
  AgentRunClient,
  dispatchPromptOverNcp,
  type DirectPromptDispatchParams,
  type NextclawKernel,
} from "@nextclaw/kernel";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { AgentCommandOptions } from "@nextclaw-service/shared/types/cli.types.js";
import { printAgentResponse, prompt } from "@nextclaw-service/shared/utils/cli.utils.js";

const EXIT_COMMANDS = new Set(["exit", "quit", "/exit", "/quit", ":q"]);
type CliPromptParams = Pick<DirectPromptDispatchParams, "agentRunClient" | "config" | "content" | "metadata" | "sessionKey">;

function createCliHistoryInterface() {
  const historyFile = join(getDataDir(), "history", "cli_history");
  mkdirSync(resolve(historyFile, ".."), { recursive: true });

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

async function sendCliPrompt(params: CliPromptParams): Promise<boolean> {
  try {
    const response = await dispatchPromptOverNcp(params);
    printAgentResponse(response);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    console.error(`Error: ${message.trim() || "Unknown error"}`);
    return false;
  }
}

async function runCliInteractiveLoop(params: {
  logo: string;
  config: Config;
  agentRunClient: AgentRunClient;
  sessionKey: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const { agentRunClient, config, logo, metadata, sessionKey } = params;
  console.log(`${logo} Interactive mode (type exit or Ctrl+C to quit)\n`);
  const rl = createCliHistoryInterface();

  while (true) {
    const line = await prompt(rl, "You: ");
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (EXIT_COMMANDS.has(trimmed.toLowerCase())) {
      rl.close();
      break;
    }
    await sendCliPrompt({
      config,
      agentRunClient,
      sessionKey,
      content: trimmed,
      metadata,
    });
  }
}

export async function runCliAgentCommand(params: {
  logo: string;
  opts: AgentCommandOptions;
  config: Config;
  kernel: NextclawKernel;
}): Promise<void> {
  const {
    config,
    kernel,
    logo,
    opts,
  } = params;
  await kernel.extensions.load({ config });
  await kernel.start();

  try {
    const agentRunClient = new AgentRunClient({
      eventBus: kernel.eventBus,
      ingress: kernel.ingress,
    });
    const sessionKey = opts.session ?? "cli:default";
    const sharedMetadata = typeof opts.model === "string" && opts.model.trim()
      ? { model: opts.model.trim() }
      : {};

    if (opts.message) {
      const success = await sendCliPrompt({
        config,
        agentRunClient,
        sessionKey,
        content: opts.message,
        metadata: sharedMetadata,
      });
      if (!success) {
        process.exitCode = 1;
      }
      return;
    }

    await runCliInteractiveLoop({
      logo,
      config,
      agentRunClient,
      sessionKey,
      metadata: sharedMetadata,
    });
  } finally {
    await kernel.dispose();
  }
}
