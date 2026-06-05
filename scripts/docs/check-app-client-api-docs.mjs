#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const appClientSourcePath = resolve(root, "packages/nextclaw-client-sdk/src/nextclaw-app-client.utils.ts");
const readmePath = resolve(root, "packages/nextclaw-client-sdk/README.md");
const bridgeReferencePath = resolve(
  root,
  "packages/nextclaw-core/src/features/agent/shared/skills/panel-app-creator/references/panel-app-bridge-api.md",
);

function read(path) {
  return readFileSync(path, "utf8");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function extractProjectedApis(source) {
  const apis = [];
  const namespacePattern = /^ {4}([A-Za-z]\w*): \{\n([\s\S]*?)^ {4}\},/gm;
  let namespaceMatch = namespacePattern.exec(source);

  while (namespaceMatch) {
    const [, namespace, body] = namespaceMatch;
    const methodPattern = /^ {6}([A-Za-z]\w*): hostClient\./gm;
    let methodMatch = methodPattern.exec(body);
    while (methodMatch) {
      apis.push(`${namespace}.${methodMatch[1]}`);
      methodMatch = methodPattern.exec(body);
    }
    namespaceMatch = namespacePattern.exec(source);
  }

  return uniqueSorted(apis);
}

function extractReadmeApiMap(readme) {
  const sectionMatch = readme.match(/## App Client API Map\n([\s\S]*?)(?=\n## |\n# |$)/);
  if (!sectionMatch) {
    throw new Error("README.md missing ## App Client API Map section");
  }

  const apis = [];
  const apiPattern = /`([A-Za-z]\w*)\.([A-Za-z]\w*)\(\)`/g;
  let apiMatch = apiPattern.exec(sectionMatch[1]);
  while (apiMatch) {
    apis.push(`${apiMatch[1]}.${apiMatch[2]}`);
    apiMatch = apiPattern.exec(sectionMatch[1]);
  }
  return uniqueSorted(apis);
}

function diffArrays(expected, actual) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((api) => !actualSet.has(api)),
    extra: actual.filter((api) => !expectedSet.has(api)),
  };
}

function assertNoStaleBridgeGuidance(content) {
  const staleFragments = [
    "client.agentRuns.stream()` 在 Panel App 中会抛错",
    "`text.delta`",
    "case 'text.delta'",
    "case \"text.delta\"",
  ];

  const stale = staleFragments.filter((fragment) => content.includes(fragment));
  if (stale.length > 0) {
    throw new Error(`bridge reference contains stale App Client guidance: ${stale.join(", ")}`);
  }
}

const projectedApis = extractProjectedApis(read(appClientSourcePath));
const readmeApis = extractReadmeApiMap(read(readmePath));
const diff = diffArrays(projectedApis, readmeApis);

assertNoStaleBridgeGuidance(read(bridgeReferencePath));

if (diff.missing.length > 0 || diff.extra.length > 0) {
  console.error("[check-app-client-api-docs] README App Client API Map drift detected");
  if (diff.missing.length > 0) {
    console.error(`  missing: ${diff.missing.join(", ")}`);
  }
  if (diff.extra.length > 0) {
    console.error(`  extra: ${diff.extra.join(", ")}`);
  }
  process.exit(1);
}

console.log(`[check-app-client-api-docs] OK: ${projectedApis.length} App Client APIs documented`);
