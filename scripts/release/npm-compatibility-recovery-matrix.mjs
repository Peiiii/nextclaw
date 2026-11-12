import { readFileSync } from "node:fs";

const platforms = [
  ["linux-x64", "ubuntu-22.04"],
  ["windows-x64", "windows-latest"],
  ["darwin-arm64", "macos-15"],
  ["darwin-x64", "macos-15-intel"],
];
const nodeVersions = ["20.19.0", "22.19.0", "24", "26"];

export const NPM_COMPATIBILITY_MATRIX = platforms.flatMap(([platform, os]) =>
  nodeVersions.map((node) => ({ node, os, platform, reused: false })),
);

export function resolveNpmCompatibilityRecoveryMatrix({ isRecovery, jobs = [], sourceCommit, targetVersion }) {
  if (!isRecovery) return { include: NPM_COMPATIBILITY_MATRIX, reused: false };
  if (!/^[a-f0-9]{40}$/.test(sourceCommit ?? "") || !/^\d+\.\d+\.\d+$/.test(targetVersion ?? "")) {
    throw new Error("Compatibility recovery requires the immutable source commit and target version.");
  }

  const conclusionByName = new Map();
  for (const job of jobs) {
    if (typeof job.name !== "string") continue;
    const suffix = ` @${targetVersion}`;
    const name = job.name.endsWith(suffix) ? job.name.slice(0, -suffix.length)
      : job.sourceCommit === sourceCommit ? job.name : null;
    if (name && (job.conclusion === "success" || !conclusionByName.has(name))) {
      conclusionByName.set(name, job.conclusion);
    }
  }
  const unresolved = NPM_COMPATIBILITY_MATRIX.filter((entry) =>
    conclusionByName.get(jobName(entry)) !== "success",
  );
  if (unresolved.length === 0 && NPM_COMPATIBILITY_MATRIX.every((entry) =>
    conclusionByName.has(jobName(entry)),
  )) {
    return {
      include: [{ node: "reused", os: "ubuntu-22.04", platform: "reused", reused: true }],
      reused: true,
    };
  }
  return { include: unresolved, reused: false };
}

function jobName({ node, platform }) {
  return `verify NPM ${platform} Node ${node}`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const isRecovery = readArg("--is-recovery") === "true";
  const jobsFile = readArg("--jobs-file");
  const jobs = jobsFile ? parseJobs(readFileSync(jobsFile, "utf8")) : [];
  process.stdout.write(`${JSON.stringify(resolveNpmCompatibilityRecoveryMatrix({ isRecovery, jobs,
    sourceCommit: readArg("--source-commit"), targetVersion: readArg("--target-version") }))}\n`);
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
