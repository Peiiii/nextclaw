#!/usr/bin/env node

import { inspectPaths, printHuman } from "./maintainability-guard-core.mjs";
import { listChangedPaths } from "./maintainability-guard-support.mjs";

function parseArgs(argv) {
  const args = {
    paths: null,
    json: false,
    noFail: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--no-fail") {
      args.noFail = true;
      continue;
    }
    if (arg === "--paths") {
      args.paths = [];
      for (let cursor = index + 1; cursor < argv.length; cursor += 1) {
        const entry = argv[cursor];
        if (entry.startsWith("--")) {
          break;
        }
        args.paths.push(entry);
        index = cursor;
      }
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = args.paths && args.paths.length > 0 ? args.paths : listChangedPaths();
  const report = await inspectPaths(paths);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  if (args.noFail) {
    process.exit(0);
  }
  process.exit(report.summary.errors > 0 ? 1 : 0);
}

await main();
