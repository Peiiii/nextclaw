#!/usr/bin/env node

import { parseArgs } from "./startup-readiness-options.mjs";
import { printPrettySummary, runBenchmark } from "./startup-readiness-runner.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const summary = await runBenchmark(options);
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  printPrettySummary(summary);
}

await main();
