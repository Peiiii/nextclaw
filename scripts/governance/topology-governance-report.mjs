#!/usr/bin/env node

import { buildTopologyReport } from "./topology-governance-graph.mjs";

function parseArgs(argv) {
  const args = {
    json: false,
    failOnViolations: false,
    top: 15
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--fail-on-violations") {
      args.failOnViolations = true;
      continue;
    }
    if (arg === "--top") {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.top = parsed;
      }
      index += 1;
    }
  }

  return args;
}

function printHuman(report, topLimit) {
  console.log("Topology governance report");
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Modules scanned: ${report.summary.modules}`);
  console.log(`Internal edges: ${report.summary.internalEdges}`);
  console.log(`Cross-layer violations: ${report.summary.crossLayerViolations}`);
  console.log(`Suspected orphans: ${report.summary.suspectedOrphans}`);

  const printList = (title, items, formatter) => {
    console.log("");
    console.log(`${title} (${Math.min(topLimit, items.length)})`);
    for (const item of items.slice(0, topLimit)) {
      console.log(formatter(item));
    }
  };

  printList("Top fan-in", report.topFanIn, (entry) => `- [${entry.count}] ${entry.path} (${entry.layer})`);
  printList("Top fan-out", report.topFanOut, (entry) => `- [${entry.count}] ${entry.path} (${entry.layer})`);
  printList(
    "Cross-layer violations",
    report.crossLayerViolations,
    (entry) => `- [${entry.workspace}] ${entry.sourcePath} -> ${entry.targetPath} (${entry.reason})`
  );
  printList("Suspected orphans", report.suspectedOrphans, (entry) => `- [${entry.workspace}] ${entry.path} (${entry.layer})`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildTopologyReport(args.top);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report, args.top);
  }

  if (args.failOnViolations && report.summary.crossLayerViolations > 0) {
    process.exit(1);
  }
}

main();
