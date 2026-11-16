import { readFileSync } from "node:fs";

const platforms = [
  ["linux-x64", "ubuntu-22.04"],
  ["windows-x64", "windows-latest"],
  ["darwin-arm64", "macos-15"],
  ["darwin-x64", "macos-15-intel"],
];
const nodeVersions = ["20.19.0", "22.19.0", "24", "26"];
const reusedCell = { node: "reused", os: "ubuntu-22.04", platform: "reused", reused: true };

export const NPM_COMPATIBILITY_MATRIX = platforms.flatMap(([platform, os]) =>
  nodeVersions.map((node) => ({ node, os, platform, reused: false })),
);

export function groupNpmCompatibilityMatrix(entries = NPM_COMPATIBILITY_MATRIX) {
  if (entries.length === 1 && entries[0].reused === true && entries[0].platform === "reused") return [{ ...reusedCell, nodes: [] }];
  if (!entries.length || entries.some(entry => !NPM_COMPATIBILITY_MATRIX.some(candidate =>
    candidate.platform === entry.platform && candidate.node === entry.node))) throw new Error("Invalid compatibility cells.");
  return platforms.flatMap(([platform, os]) => {
    const nodes = nodeVersions.filter(node => entries.some(entry => entry.platform === platform && entry.node === node));
    return nodes.length ? [{ platform, os, nodes, node: nodes.join(","), reused: false }] : [];
  });
}

export function resolveNpmCompatibilityRecoveryMatrix({ isRecovery, jobs = [], sourceCommit, targetVersion }) {
  if (!isRecovery) return { include: NPM_COMPATIBILITY_MATRIX, reused: false };
  if (!/^[a-f0-9]{40}$/.test(sourceCommit ?? "") || !/^\d+\.\d+\.\d+$/.test(targetVersion ?? "")) {
    throw new Error("Compatibility recovery requires the immutable source commit and target version.");
  }

  const conclusionByName = new Map();
  for (const job of jobs) {
    if (typeof job.name !== "string") continue;
    const leafName = job.name.split(" / ").at(-1);
    const suffix = ` @${targetVersion}`;
    const name = leafName.endsWith(suffix) ? leafName.slice(0, -suffix.length)
      : job.sourceCommit === sourceCommit ? leafName : null;
    const match = name?.match(/^verify NPM ([a-z0-9-]+) Node ([0-9.,]+)$/);
    if (!match || !match[2].split(",").every(node => nodeVersions.includes(node))) continue;
    for (const node of match[2].split(",")) {
      const cell = jobName({ platform: match[1], node });
      if (job.conclusion === "success" || !conclusionByName.has(cell)) conclusionByName.set(cell, job.conclusion);
    }
  }
  const unresolved = NPM_COMPATIBILITY_MATRIX.filter((entry) =>
    conclusionByName.get(jobName(entry)) !== "success",
  );
  if (unresolved.length === 0 && NPM_COMPATIBILITY_MATRIX.every((entry) =>
    conclusionByName.has(jobName(entry)),
  )) {
    return {
      include: [{ ...reusedCell }],
      reused: true,
    };
  }
  return { include: unresolved, reused: false };
}

function jobName({ node, platform }) {
  return `verify NPM ${platform} Node ${node}`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  if (process.argv.includes("--grouped-input")) {
    const raw = readArg("--grouped-input");
    const entries = raw ? JSON.parse(raw).include : NPM_COMPATIBILITY_MATRIX;
    if (!Array.isArray(entries)) throw new Error("Invalid compatibility matrix.");
    process.stdout.write(`${JSON.stringify({ include: groupNpmCompatibilityMatrix(entries) })}\n`);
  } else {
  const isRecovery = readArg("--is-recovery") === "true";
  const jobsFile = readArg("--jobs-file");
  const jobs = jobsFile ? parseJobs(readFileSync(jobsFile, "utf8")) : [];
  process.stdout.write(`${JSON.stringify(resolveNpmCompatibilityRecoveryMatrix({ isRecovery, jobs,
    sourceCommit: readArg("--source-commit"), targetVersion: readArg("--target-version") }))}\n`);
  }
}

function parseJobs(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed.startsWith("[")
    ? JSON.parse(trimmed)
    : trimmed.split("\n").map((line) => JSON.parse(line));
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}
