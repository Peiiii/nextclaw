import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const GENERATED_PATHS = ["packages/nextclaw-service/build", "packages/nextclaw/ui-dist"];
const isCheckMode = process.argv.includes("--check");

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"]
  });
}

function readTrackedPaths() {
  return runGit(["ls-files", "--", ...GENERATED_PATHS])
    .trim()
    .split("\n")
    .filter(Boolean);
}

function isIgnored(path) {
  return (
    spawnSync("git", ["check-ignore", "--no-index", "--quiet", "--", `${path}/`], {
      stdio: "ignore",
    }).status === 0
  );
}

const trackedPaths = readTrackedPaths();
const unignoredPaths = GENERATED_PATHS.filter((path) => !isIgnored(path));

if (trackedPaths.length > 0 || unignoredPaths.length > 0) {
  if (trackedPaths.length > 0) {
    console.error("[clean:generated] generated artifacts are still tracked:");
    console.error(trackedPaths.join("\n"));
  }
  if (unignoredPaths.length > 0) {
    console.error("[clean:generated] generated artifact directories are not ignored:");
    console.error(unignoredPaths.join("\n"));
  }
  process.exit(1);
}

if (isCheckMode) {
  console.log("[clean:generated] generated artifact Git boundary is valid.");
  process.exit(0);
}

for (const path of GENERATED_PATHS) {
  rmSync(path, { recursive: true, force: true });
}

console.log("[clean:generated] generated artifact directories removed.");
