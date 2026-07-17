import { execFileSync } from "node:child_process";

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function readFlag(name) {
  return process.argv.includes(name);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  }).trim();
}

function readChangedFiles(left, right) {
  const output = git(["diff", "--name-only", `${left}..${right}`]);
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

function resolveRef(ref) {
  return git(["rev-parse", "--verify", ref]);
}

function resolveMergeBase(left, right) {
  return git(["merge-base", left, right]);
}

function isReleaseRelevantPath(file) {
  if (
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === "pnpm-workspace.yaml" ||
    file === "AGENTS.md"
  ) {
    return true;
  }
  return [
    ".changeset/",
    ".agents/skills/",
    "apps/",
    "packages/",
    "scripts/release/",
    "workers/"
  ].some((prefix) => file.startsWith(prefix));
}

function printFiles(title, files) {
  console.log(title);
  if (files.length === 0) {
    console.log("  <none>");
    return;
  }
  for (const file of files) {
    console.log(`  - ${file}`);
  }
}

const targetRef = readOption("--target", "master");
const releaseRef = readOption("--release", "HEAD");
const reportOnly = readFlag("--report-only");

const targetCommit = resolveRef(targetRef);
const releaseCommit = resolveRef(releaseRef);
const mergeBaseCommit = resolveMergeBase(targetCommit, releaseCommit);
const targetOnlyFiles = readChangedFiles(mergeBaseCommit, targetCommit);
const releaseOnlyFiles = readChangedFiles(mergeBaseCommit, releaseCommit);
const targetOnlyRelevantFiles = targetOnlyFiles.filter(isReleaseRelevantPath);
const releaseOnlyRelevantFiles = releaseOnlyFiles.filter(isReleaseRelevantPath);

console.log(`[release:branch-closure] target ${targetRef}: ${targetCommit}`);
console.log(`[release:branch-closure] release ${releaseRef}: ${releaseCommit}`);
console.log(`[release:branch-closure] merge-base: ${mergeBaseCommit}`);
printFiles("[release:branch-closure] target-only release-relevant files:", targetOnlyRelevantFiles);
printFiles("[release:branch-closure] release-only release-relevant files:", releaseOnlyRelevantFiles);

if (!reportOnly && (targetOnlyRelevantFiles.length > 0 || releaseOnlyRelevantFiles.length > 0)) {
  console.error("[release:branch-closure] branch closure check failed.");
  if (targetOnlyRelevantFiles.length > 0) {
    console.error("The target branch has release-relevant changes that are missing from the release branch.");
  }
  if (releaseOnlyRelevantFiles.length > 0) {
    console.error("The release branch has release metadata or source changes that are missing from the target branch.");
  }
  process.exit(1);
}

console.log("[release:branch-closure] branch closure check passed.");
