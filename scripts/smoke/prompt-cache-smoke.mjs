#!/usr/bin/env node

import { fail, parseArgs, printPretty } from "./prompt-cache/prompt-cache-smoke.shared.mjs";
import { ProviderDirectPromptCacheSmokeRunner } from "./prompt-cache/prompt-cache-smoke.provider-direct.mjs";
import { NcpChatPromptCacheSmokeRunner } from "./prompt-cache/prompt-cache-smoke.ncp-chat.mjs";

function createRunner(options) {
  if (options.transport === "ncp-chat") {
    return new NcpChatPromptCacheSmokeRunner(options);
  }
  return new ProviderDirectPromptCacheSmokeRunner(options);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    const runner = createRunner(options);
    const result = await runner.run();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
      return;
    }
    printPretty(result);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), options.json);
  }
}

await main();
